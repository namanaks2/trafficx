"""
TrafficX HTTP gossip edge node.

This is an honest, process-level HTTP gossip implementation; it is not libp2p.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import random
import sqlite3
import uuid
from collections import OrderedDict, deque
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from aiokafka import AIOKafkaProducer
    KAFKA_OK = True
except ImportError:
    AIOKafkaProducer = None
    KAFKA_OK = False

try:
    from ledger import ChainedLedger
except ImportError:
    from .ledger import ChainedLedger

try:
    from app.ml.lstm_predictor import LSTMPredictor
except ImportError:
    LSTMPredictor = None

try:
    from federated import FederatedLinearBaseline
except ImportError:
    from .federated import FederatedLinearBaseline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("edge-node")

NODE_ID = os.getenv("NODE_ID", "NODE-A")
NODE_ZONE = os.getenv("NODE_ZONE", "zone-a")
NODE_HOST = os.getenv("NODE_HOST", "0.0.0.0")
NODE_PORT = int(os.getenv("NODE_PORT", "7001"))
PEER_ADDRS = [p.strip() for p in os.getenv("PEER_ADDRESSES", "").split(",") if p.strip()]
KAFKA_BOOT = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
HEARTBEAT_S = int(os.getenv("HEARTBEAT_INTERVAL_SEC", "5"))
GOSSIP_S = int(os.getenv("GOSSIP_INTERVAL_SEC", "8"))
GOSSIP_FANOUT = int(os.getenv("GOSSIP_FANOUT", "2"))
NETWORK_SECRET = os.getenv("NETWORK_SECRET", "change-me-in-production")
ENABLE_SIMULATION = os.getenv("ENABLE_SIMULATION", "false").lower() == "true"
ENABLE_FEDERATED = os.getenv("ENABLE_FEDERATED", "false").lower() == "true"
ALLOWED_ORIGINS = [
    x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if x.strip()
]
TRAFFIC_TZ = os.getenv("TRAFFIC_TZ", "Asia/Kolkata")
SPILL_PATH = os.getenv("SPILL_PATH")
ADVERTISE_ADDRESS = os.getenv("NODE_ADVERTISE_ADDRESS", f"{NODE_HOST}:{NODE_PORT}")

ledger = ChainedLedger(NODE_ID)
local_predictor = LSTMPredictor() if LSTMPredictor else None
federated_model = FederatedLinearBaseline() if ENABLE_FEDERATED else None
peer_table: dict[str, dict] = {}
seen_messages: OrderedDict[str, None] = OrderedDict()
kafka_buffer: deque[dict] = deque(maxlen=10000)
kafka_dropped = 0
kafka_connected = False
signature_rejections = 0
kafka_producer: Optional[object] = None
degraded_until: Optional[datetime] = None

state = {
    "node_id": NODE_ID,
    "zone": NODE_ZONE,
    "status": "online",
    "started_at": datetime.now(timezone.utc).isoformat(),
    "last_heartbeat": datetime.now(timezone.utc).isoformat(),
    "peers": peer_table,
    "traffic_summary": {},
    "records_processed": 0,
    "processing_load": 0.0,
    "recent_events": [],
    "kafka_buffer_size": 0,
    "kafka_connected": False,
    "kafka_dropped": 0,
    "signature_rejections": 0,
}

app = FastAPI(title=f"TrafficX Edge Node {NODE_ID}")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])


def now() -> datetime:
    return datetime.now(timezone.utc)


def utc_iso(dt: Optional[datetime] = None) -> str:
    return (dt or now()).isoformat()


def is_degraded() -> bool:
    return degraded_until is not None and now() < degraded_until


def canonical_json(payload: dict) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")


def sign_payload(payload: dict) -> str:
    return hmac.new(NETWORK_SECRET.encode(), canonical_json(payload), hashlib.sha256).hexdigest()


def verify_signature(payload: dict) -> bool:
    supplied = payload.pop("_signature_check", payload.get("signature", ""))
    unsigned = dict(payload)
    unsigned.pop("signature", None)
    expected = hmac.new(NETWORK_SECRET.encode(), canonical_json(unsigned), hashlib.sha256).hexdigest()
    return hmac.compare_digest(str(supplied), expected)


def generate_zone_summary() -> dict:
    """Generate one simulated observation using zone-local rolling state."""
    local = now().astimezone(ZoneInfo(TRAFFIC_TZ))
    hour = local.hour
    is_rush = 7 <= hour <= 9 or 17 <= hour <= 19
    target_speed = 22.0 if is_rush else 55.0
    previous = state["traffic_summary"].get("avg_speed", target_speed)
    speed = max(5.0, min(100.0, previous * 0.9 + target_speed * 0.1 + random.gauss(0, 1.5)))
    vc = random.randint(300, 800) if is_rush else random.randint(80, 350)
    congestion = max(5.0, min(99.0, 100.0 - speed / 80.0 * 100.0))
    summary = {
        "zone": NODE_ZONE,
        "avg_speed": round(speed, 1),
        "vehicle_count": vc,
        "congestion_pct": round(congestion, 1),
        "timestamp": utc_iso(),
        "source_node": NODE_ID,
        "source": "traffic-simulated",
    }
    state["traffic_summary"] = summary
    state["records_processed"] += 1
    state["processing_load"] = round(random.uniform(10, 60), 1)
    return summary


def mark_degraded(seconds: int):
    global degraded_until
    degraded_until = now() + timedelta(seconds=seconds)
    state["status"] = "degraded"


def refresh_peer_statuses():
    cutoff = now().timestamp() - (3 * GOSSIP_S)
    for addr, peer in list(peer_table.items()):
        if not peer.get("last_seen"):
            peer["status"] = "unknown"
            continue
        try:
            last = datetime.fromisoformat(peer["last_seen"])
            peer["status"] = "online" if last.timestamp() >= cutoff else "unreachable"
        except Exception:
            peer["status"] = "unreachable"


async def start_kafka():
    global kafka_producer, kafka_connected
    if not KAFKA_OK:
        return
    old_producer = kafka_producer
    kafka_producer = None
    if old_producer is not None:
        try:
            await old_producer.stop()
        except Exception as exc:
            logger.debug("Previous Kafka producer shutdown failed: %s", exc)
    delay = 1
    while True:
        try:
            producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOT, value_serializer=None, key_serializer=None)
            await producer.start()
            kafka_producer = producer
            kafka_connected = True
            state["kafka_connected"] = True
            logger.info("Kafka connected")
            return
        except Exception as exc:
            kafka_connected = False
            state["kafka_connected"] = False
            logger.warning("Kafka unavailable: %s; retrying in %ss", exc, delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)


async def kafka_reconnect_loop():
    while True:
        if not kafka_connected:
            await start_kafka()
        await asyncio.sleep(2)


async def flush_kafka_buffer():
    global kafka_dropped, kafka_connected
    if not kafka_connected or kafka_producer is None:
        return
    if SPILL_PATH:
        while kafka_connected:
            try:
                with sqlite3.connect(SPILL_PATH) as conn:
                    conn.execute("CREATE TABLE IF NOT EXISTS spill (payload TEXT)")
                    row = conn.execute("SELECT rowid, payload FROM spill ORDER BY rowid LIMIT 1").fetchone()
            except sqlite3.Error as exc:
                logger.warning("Kafka spill read failed: %s", exc)
                break
            if row is None:
                break
            try:
                item = json.loads(row[1])
                await kafka_producer.send_and_wait(
                    "traffic.node_status",
                    value=json.dumps(item, default=str).encode(),
                    key=NODE_ID.encode(),
                )
                with sqlite3.connect(SPILL_PATH) as conn:
                    conn.execute("DELETE FROM spill WHERE rowid = ?", (row[0],))
            except Exception as exc:
                logger.warning("Kafka spill replay failed; retaining event: %s", exc)
                kafka_connected = False
                state["kafka_connected"] = False
                return
    while kafka_buffer:
        item = kafka_buffer[0]
        try:
            await kafka_producer.send_and_wait("traffic.node_status", value=json.dumps(item, default=str).encode(), key=NODE_ID.encode())
            kafka_buffer.popleft()
        except Exception as exc:
            logger.warning("Kafka send failed; retaining buffered events: %s", exc)
            kafka_connected = False
            state["kafka_connected"] = False
            return
    state["kafka_buffer_size"] = len(kafka_buffer)
    state["kafka_dropped"] = kafka_dropped


def enqueue_kafka(item: dict):
    global kafka_dropped
    if len(kafka_buffer) == kafka_buffer.maxlen:
        overflow = kafka_buffer.popleft()
        if SPILL_PATH:
            try:
                with sqlite3.connect(SPILL_PATH) as conn:
                    conn.execute("CREATE TABLE IF NOT EXISTS spill (payload TEXT)")
                    conn.execute("INSERT INTO spill(payload) VALUES (?)", (json.dumps(overflow, default=str),))
            except Exception as exc:
                kafka_dropped += 1
                logger.warning("Kafka spill failed: %s", exc)
        else:
            kafka_dropped += 1
    kafka_buffer.append(item)
    state["kafka_buffer_size"] = len(kafka_buffer)
    state["kafka_dropped"] = kafka_dropped


def make_gossip_message(
    summary: dict,
    prediction: dict,
    ttl: int = 5,
    federated_update: Optional[dict] = None,
) -> dict:
    unsigned = {
        "msg_id": str(uuid.uuid4()),
        "origin": NODE_ID,
        "sender_address": ADVERTISE_ADDRESS,
        "sender_id": NODE_ID,
        "seq": state["records_processed"],
        "ttl": ttl,
        "summary": summary,
        "prediction": prediction,
        "federated_update": federated_update,
        "known_peers": {addr: {"id": p.get("id"), "last_seen": p.get("last_seen")} for addr, p in peer_table.items()},
        "timestamp": utc_iso(),
    }
    unsigned["signature"] = sign_payload(unsigned)
    return unsigned


def remember_message(msg_id: str) -> bool:
    if msg_id in seen_messages:
        return False
    seen_messages[msg_id] = None
    if len(seen_messages) > 5000:
        seen_messages.popitem(last=False)
    return True


async def send_gossip(peer_addresses: list[str], message: dict):
    async with httpx.AsyncClient(timeout=3) as client:
        async def send(addr: str):
            peer_url = f"http://{addr}/gossip"
            try:
                r = await client.post(peer_url, json=message)
                if r.status_code == 200:
                    peer_table.setdefault(addr, {})["status"] = "online"
                    peer_table[addr]["last_seen"] = utc_iso()
                    peer_table[addr]["id"] = r.json().get("node_id", addr)
            except Exception as exc:
                logger.warning("Gossip to %s failed: %s", addr, exc)
        await asyncio.gather(*(send(addr) for addr in peer_addresses))


@app.middleware("http")
async def degraded_gate(request: Request, call_next):
    if is_degraded() and request.url.path in ("/gossip", "/summary"):
        return JSONResponse({"detail": "node degraded"}, status_code=503)
    return await call_next(request)


@app.get("/heartbeat")
async def heartbeat():
    state["last_heartbeat"] = utc_iso()
    refresh_peer_statuses()
    return {
        "node_id": NODE_ID,
        "zone": NODE_ZONE,
        "status": "degraded" if is_degraded() else "online",
        "timestamp": state["last_heartbeat"],
        "peers_seen": [p.get("id") for p in peer_table.values()],
    }


@app.get("/summary")
async def get_summary():
    refresh_peer_statuses()
    return {**state["traffic_summary"]} if state["traffic_summary"] else generate_zone_summary()


@app.post("/gossip")
async def receive_gossip(payload: dict):
    global signature_rejections
    signature = payload.get("signature", "")
    unsigned = dict(payload)
    unsigned.pop("signature", None)
    if not isinstance(signature, str) or not signature or not hmac.compare_digest(signature, sign_payload(unsigned)):
        signature_rejections += 1
        state["signature_rejections"] = signature_rejections
        raise HTTPException(status_code=401, detail="invalid gossip signature")

    ttl = payload.get("ttl")
    if isinstance(ttl, bool) or not isinstance(ttl, int) or not 1 <= ttl <= 20:
        raise HTTPException(status_code=400, detail="gossip ttl must be an integer from 1 to 20")
    summary = payload.get("summary", {})
    known_peers = payload.get("known_peers", {})
    if not isinstance(summary, dict) or not isinstance(known_peers, dict):
        raise HTTPException(status_code=400, detail="invalid gossip summary or peer list")

    msg_id = payload.get("msg_id")
    if not isinstance(msg_id, str) or not msg_id or len(msg_id) > 128:
        raise HTTPException(status_code=400, detail="invalid gossip message id")
    if not remember_message(msg_id):
        return {"ack": True, "node_id": NODE_ID, "duplicate": True}

    sender = payload.get("origin", "unknown")
    sender_id = payload.get("sender_id", sender)
    sender_address = payload.get("sender_address")
    if isinstance(sender_address, str) and sender_address and sender != NODE_ID:
        peer_table[sender_address] = {
            "id": sender_id,
            "last_seen": utc_iso(),
            "summary": summary if isinstance(summary, dict) else {},
            "status": "online",
        }
    if summary:
        state["recent_events"].insert(0, {
            "type": "gossip_received",
            "msg_id": msg_id,
            "from": sender,
            "timestamp": utc_iso(),
            "summary": summary,
            "prediction": payload.get("prediction"),
        })
        state["recent_events"] = state["recent_events"][:20]
        ledger.add_entry(sender, summary.get("zone", "unknown"), summary)

    federated_update = payload.get("federated_update")
    if federated_model and federated_update:
        try:
            federated_model.aggregate(federated_update)
        except (TypeError, ValueError) as exc:
            logger.warning("Ignoring invalid federated update from %s: %s", sender, exc)

    for addr, info in known_peers.items():
        if isinstance(addr, str) and isinstance(info, dict):
            peer_table.setdefault(addr, {"id": info.get("id"), "last_seen": info.get("last_seen"), "summary": {}, "status": "unknown"})
    if ttl > 1:
        excluded = {sender_address, ADVERTISE_ADDRESS}
        candidates = [
            addr for addr, peer in peer_table.items()
            if addr not in excluded and peer.get("id") not in {sender_id, sender, NODE_ID}
        ]
        targets = random.sample(candidates, min(GOSSIP_FANOUT, len(candidates)))
        relay = dict(payload)
        relay["ttl"] = ttl - 1
        relay["sender_address"] = ADVERTISE_ADDRESS
        relay["sender_id"] = NODE_ID
        relay["signature"] = sign_payload({k: v for k, v in relay.items() if k != "signature"})
        if targets:
            await send_gossip(targets, relay)
    return {"ack": True, "node_id": NODE_ID}


@app.get("/state")
async def get_state():
    refresh_peer_statuses()
    return {
        **state,
        "peers": peer_table,
        "kafka_buffer_size": len(kafka_buffer),
        "kafka_connected": kafka_connected,
        "kafka_dropped": kafka_dropped,
        "signature_rejections": signature_rejections,
    }


@app.get("/ledger")
async def get_ledger():
    return {"chain": ledger.get_recent(), "length": ledger.length}


@app.get("/ledger/verify")
async def verify_ledger():
    return {"valid": ledger.verify()}


@app.post("/simulate/failure")
async def simulate_failure(seconds: int = 15):
    if not ENABLE_SIMULATION:
        raise HTTPException(status_code=404, detail="simulation endpoints disabled")
    if seconds < 1 or seconds > 300:
        raise HTTPException(status_code=422, detail="seconds must be between 1 and 300")
    mark_degraded(seconds)
    return {"node_id": NODE_ID, "status": "degraded", "recover_in_seconds": seconds}


async def gossip_loop():
    while True:
        await asyncio.sleep(GOSSIP_S)
        if is_degraded():
            continue
        summary = generate_zone_summary()
        ledger.add_entry(NODE_ID, NODE_ZONE, summary)
        event = {
            "road_id": f"{NODE_ID}:{NODE_ZONE}",
            "timestamp": summary["timestamp"],
            "speed": summary["avg_speed"],
            "vehicle_count": summary["vehicle_count"],
        }
        prediction = (
            await local_predictor.predict_async(event)
            if local_predictor and local_predictor.loaded
            else {
                "predicted_congestion_15": summary["congestion_pct"],
                "predicted_congestion_30": summary["congestion_pct"],
                "predicted_congestion_60": summary["congestion_pct"],
                "model_version": "rule-based-fallback",
                "is_simulated": True,
                "warming_up": True,
            }
        )
        federated_update = None
        if federated_model:
            prediction["federated_baseline_congestion"] = round(federated_model.predict(summary), 1)
            federated_model.observe(summary)
            prediction["federated_validation_mae"] = federated_model.validation_mae
            federated_update = federated_model.export_update()
        refresh_peer_statuses()
        candidates = [addr for addr, peer in peer_table.items() if peer.get("status") != "unreachable"]
        targets = random.sample(candidates, min(GOSSIP_FANOUT, len(candidates)))
        if targets:
            await send_gossip(
                targets,
                make_gossip_message(summary, prediction, federated_update=federated_update),
            )
        enqueue_kafka({
            "node_id": NODE_ID, "zone": NODE_ZONE, "status": state["status"],
            "last_heartbeat": state["last_heartbeat"], "processing_load": state["processing_load"],
            "peers_connected": len([p for p in peer_table.values() if p.get("status") == "online"]),
            "records_processed": state["records_processed"], "timestamp": utc_iso(),
        })
        await flush_kafka_buffer()


async def heartbeat_loop():
    global degraded_until
    while True:
        await asyncio.sleep(HEARTBEAT_S)
        state["last_heartbeat"] = utc_iso()
        refresh_peer_statuses()
        if degraded_until and now() >= degraded_until:
            degraded_until = None
            state["status"] = "online"


async def start_kafka_reconnect_task():
    asyncio.create_task(kafka_reconnect_loop())


async def run():
    for addr in PEER_ADDRS:
        peer_table.setdefault(addr, {"id": None, "last_seen": "", "summary": {}, "status": "unknown"})
    generate_zone_summary()
    if local_predictor:
        local_predictor.load()
        if local_predictor.loaded:
            local_predictor.seed_windows_from_cassandra()
    if KAFKA_OK:
        asyncio.create_task(kafka_reconnect_loop())
    asyncio.create_task(gossip_loop())
    asyncio.create_task(heartbeat_loop())
    config = uvicorn.Config(app, host=NODE_HOST, port=NODE_PORT, log_level="warning")
    await uvicorn.Server(config).serve()


if __name__ == "__main__":
    asyncio.run(run())
