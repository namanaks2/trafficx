"""
TrafficX Edge Node — Gossip-based P2P implementation.

Each node runs an HTTP server (FastAPI micro-service) and gossips with peers.
"P2P" here means: each node independently initiates connections to its peers,
exchanges state without a central coordinator, and operates after peer failures.

This is an honest multi-process gossip simulation over HTTP/JSON —
NOT a libp2p DHT — which is clearly stated in the architecture docs.
"""
import asyncio
import json
import logging
import math
import os
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

try:
    from aiokafka import AIOKafkaProducer
    KAFKA_OK = True
except ImportError:
    KAFKA_OK = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("edge-node")

# ── Config from environment ───────────────────────────────────────────────────
NODE_ID       = os.getenv("NODE_ID", "NODE-A")
NODE_ZONE     = os.getenv("NODE_ZONE", "zone-a")
NODE_HOST     = os.getenv("NODE_HOST", "0.0.0.0")
NODE_PORT     = int(os.getenv("NODE_PORT", "7001"))
PEER_ADDRS    = [p.strip() for p in os.getenv("PEER_ADDRESSES", "").split(",") if p.strip()]
KAFKA_BOOT    = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
HEARTBEAT_S   = int(os.getenv("HEARTBEAT_INTERVAL_SEC", "5"))
GOSSIP_S      = int(os.getenv("GOSSIP_INTERVAL_SEC", "8"))

# ── Node State ────────────────────────────────────────────────────────────────
state = {
    "node_id":           NODE_ID,
    "zone":              NODE_ZONE,
    "status":            "online",
    "started_at":        datetime.utcnow().isoformat(),
    "last_heartbeat":    datetime.utcnow().isoformat(),
    "peers":             {},          # peer_id → {last_seen, status, summary}
    "traffic_summary":   {},
    "records_processed": 0,
    "processing_load":   0.0,
    "ledger":            [],          # last 20 gossip exchanges
}

kafka_producer: Optional[object] = None

# ── Traffic simulation for this zone ─────────────────────────────────────────
_speed = 42.0

def generate_zone_summary() -> dict:
    global _speed
    hour    = datetime.utcnow().hour
    is_rush = (7 <= hour <= 9) or (17 <= hour <= 19)
    target  = 22 if is_rush else 55
    _speed  = _speed * 0.9 + target * 0.1 + random.gauss(0, 1.5)
    _speed  = max(5, min(100, _speed))
    vc      = random.randint(300, 800) if is_rush else random.randint(80, 350)
    cong    = max(5, min(99, 100 - _speed / 80 * 100))
    return {
        "zone":            NODE_ZONE,
        "avg_speed":       round(_speed, 1),
        "vehicle_count":   vc,
        "congestion_pct":  round(cong, 1),
        "timestamp":       datetime.utcnow().isoformat(),
        "source_node":     NODE_ID,
    }


# ── FastAPI micro-server ──────────────────────────────────────────────────────
app = FastAPI(title=f"TrafficX Edge Node {NODE_ID}")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/heartbeat")
async def heartbeat():
    state["last_heartbeat"] = datetime.utcnow().isoformat()
    return {
        "node_id":    NODE_ID,
        "zone":       NODE_ZONE,
        "status":     state["status"],
        "timestamp":  state["last_heartbeat"],
        "peers_seen": list(state["peers"].keys()),
    }


@app.get("/summary")
async def get_summary():
    return {**generate_zone_summary(), "peers": {
        pid: {"status": p["status"], "last_seen": p["last_seen"]}
        for pid, p in state["peers"].items()
    }}


@app.post("/gossip")
async def receive_gossip(payload: dict):
    sender  = payload.get("node_id", "unknown")
    summary = payload.get("summary", {})
    state["peers"][sender] = {
        "status":    "online",
        "last_seen": datetime.utcnow().isoformat(),
        "summary":   summary,
    }
    state["ledger"].insert(0, {
        "type":      "gossip_received",
        "from":      sender,
        "timestamp": datetime.utcnow().isoformat(),
        "summary":   summary,
    })
    state["ledger"] = state["ledger"][:20]
    return {"ack": True, "node_id": NODE_ID}


@app.get("/state")
async def get_state():
    return state


@app.post("/simulate/failure")
async def simulate_failure():
    """Temporarily mark node as degraded to demo fault tolerance."""
    state["status"] = "degraded"
    asyncio.create_task(_recover_after(15))
    return {"node_id": NODE_ID, "status": "degraded", "recover_in_seconds": 15}


async def _recover_after(seconds: int):
    await asyncio.sleep(seconds)
    state["status"] = "online"
    logger.info("Node %s recovered.", NODE_ID)


# ── Gossip loop ───────────────────────────────────────────────────────────────

async def gossip_loop():
    async with httpx.AsyncClient(timeout=3) as client:
        while True:
            await asyncio.sleep(GOSSIP_S)
            summary = generate_zone_summary()
            state["traffic_summary"] = summary
            state["records_processed"] += 1
            state["processing_load"] = round(random.uniform(10, 60), 1)

            for peer_addr in PEER_ADDRS:
                peer_url = f"http://{peer_addr}/gossip"
                try:
                    r = await client.post(peer_url, json={
                        "node_id":  NODE_ID,
                        "zone":     NODE_ZONE,
                        "summary":  summary,
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                    if r.status_code == 200:
                        peer_id = r.json().get("node_id", peer_addr)
                        state["peers"].setdefault(peer_id, {})["status"]    = "online"
                        state["peers"][peer_id]["last_seen"] = datetime.utcnow().isoformat()
                except Exception as e:
                    # Mark peer degraded
                    for pid, p in state["peers"].items():
                        if peer_addr in pid or peer_addr.split(":")[0] in pid:
                            p["status"] = "unreachable"
                    logger.warning("Gossip to %s failed: %s", peer_addr, e)

            # Publish to Kafka
            if KAFKA_OK and kafka_producer:
                try:
                    health_msg = {
                        "node_id":          NODE_ID,
                        "zone":             NODE_ZONE,
                        "status":           state["status"],
                        "last_heartbeat":   state["last_heartbeat"],
                        "processing_load":  state["processing_load"],
                        "peers_connected":  len([p for p in state["peers"].values() if p.get("status") == "online"]),
                        "records_processed":state["records_processed"],
                        "timestamp":        datetime.utcnow().isoformat(),
                    }
                    await kafka_producer.send_and_wait("traffic.node_status",
                        value=json.dumps(health_msg, default=str).encode(), key=NODE_ID.encode())
                except Exception as e:
                    logger.warning("Kafka publish error: %s", e)


async def heartbeat_loop():
    while True:
        state["last_heartbeat"] = datetime.utcnow().isoformat()
        await asyncio.sleep(HEARTBEAT_S)


# ── Startup ───────────────────────────────────────────────────────────────────

async def start_kafka():
    global kafka_producer
    if not KAFKA_OK:
        return
    for attempt in range(10):
        try:
            from aiokafka import AIOKafkaProducer as KP
            kafka_producer = KP(
                bootstrap_servers=KAFKA_BOOT,
                value_serializer=None,  # raw bytes
                key_serializer=None,
            )
            await kafka_producer.start()
            logger.info("Kafka connected from node %s", NODE_ID)
            return
        except Exception as e:
            logger.warning("Kafka attempt %d: %s", attempt + 1, e)
            await asyncio.sleep(5)


async def run():
    await start_kafka()
    asyncio.create_task(gossip_loop())
    asyncio.create_task(heartbeat_loop())
    config = uvicorn.Config(app, host="0.0.0.0", port=NODE_PORT, log_level="warning")
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(run())
