"""
TrafficX FastAPI Backend
Starts in DEMO MODE when Kafka/Cassandra are not available.
Run:  uvicorn app.main:app --reload --port 8000
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .kafka.producer import producer
from .kafka.consumer import consumer
from .websockets.manager import ws_manager
from .api import traffic, incidents, nodes, analytics, kafka_api, health_api
from .detection.incident_detector import detect_incident
from .ml.lstm_predictor import lstm_predictor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)


# ── Kafka handlers (only called when Kafka is connected) ──────────────────────

async def handle_raw_traffic(msg: dict, meta):
    from .db.cassandra_client import cassandra
    msg["kafka_offset"] = meta.offset
    cassandra.insert_traffic_event(msg)
    await ws_manager.broadcast_traffic(msg)
    try:
        pred = lstm_predictor.predict(msg)
        pred["road_id"] = msg.get("road_id", "unknown")
        cassandra.insert_prediction(pred)
        await producer.publish_prediction(pred)
        await ws_manager.broadcast_prediction(pred)
    except Exception as e:
        logger.warning("Prediction pipeline error: %s", e)
    incident = detect_incident(msg)
    if incident:
        cassandra.insert_incident(incident)
        await producer.publish_incident(incident)
        await ws_manager.broadcast_incident(incident)


async def handle_node_status(msg: dict, meta):
    from .db.cassandra_client import cassandra
    cassandra.insert_node_health(msg)
    await ws_manager.broadcast_node_status(msg)


async def handle_prediction(msg: dict, meta):
    await ws_manager.broadcast_prediction(msg)


async def handle_incident(msg: dict, meta):
    await ws_manager.broadcast_incident(msg)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TrafficX backend (demo_mode=%s)...", settings.demo_mode)

    # Cassandra — optional, fails gracefully
    try:
        from .db.cassandra_client import cassandra
        cassandra.connect(
            contact_points=settings.cassandra_contact_points.split(","),
            port=settings.cassandra_port,
            keyspace=settings.cassandra_keyspace,
            username=settings.cassandra_username,
            password=settings.cassandra_password,
        )
    except Exception as e:
        logger.warning("Cassandra skipped: %s", e)

    # LSTM — load if model file exists, otherwise rule-based fallback
    lstm_predictor.load()

    # Kafka — optional, fails gracefully
    if not settings.demo_mode:
        await producer.start(settings.kafka_bootstrap_servers)
        consumer.on("traffic.raw",        handle_raw_traffic)
        consumer.on("traffic.node_status", handle_node_status)
        consumer.on("traffic.predictions", handle_prediction)
        consumer.on("traffic.incidents",   handle_incident)
        await consumer.start(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=settings.kafka_consumer_group,
            topics=["traffic.raw", "traffic.predictions",
                    "traffic.incidents", "traffic.node_status"],
        )
    else:
        logger.info("DEMO MODE — Kafka integration disabled. Set DEMO_MODE=false to enable.")

    logger.info("TrafficX backend ready → http://localhost:%s/api/docs", settings.api_port)
    yield

    await producer.stop()
    await consumer.stop()
    try:
        from .db.cassandra_client import cassandra
        cassandra.shutdown()
    except Exception:
        pass


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="TrafficX API",
    description="Decentralized Real-Time Traffic Intelligence Network",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(traffic.router)
app.include_router(incidents.router)
app.include_router(nodes.router)
app.include_router(analytics.router)
app.include_router(kafka_api.router)
app.include_router(health_api.router)


# ── WebSocket endpoints ───────────────────────────────────────────────────────

@app.websocket("/ws/{channel}")
async def websocket_channel(ws: WebSocket, channel: str):
    if channel not in {"all", "traffic", "predictions", "incidents", "nodes"}:
        await ws.close(code=1008)
        return
    await ws_manager.connect(ws, channel)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, channel)


@app.websocket("/ws")
async def websocket_all(ws: WebSocket):
    await ws_manager.connect(ws, "all")
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, "all")


# ── Basic endpoints ───────────────────────────────────────────────────────────

@app.get("/")
async def root():
    try:
        from .db.cassandra_client import cassandra as _cass
        cass_ok = _cass.connected
    except Exception:
        cass_ok = False
    return {
        "name": "TrafficX API",
        "version": "2.0.0",
        "demo_mode": settings.demo_mode,
        "kafka": producer.connected,
        "cassandra": cass_ok,
        "lstm": lstm_predictor.loaded,
        "docs": "/api/docs",
    }


@app.get("/health")
async def health():
    try:
        from .db.cassandra_client import cassandra as _cass
        cass_status = _cass.status()
    except Exception:
        cass_status = {"connected": False}
    return {
        "status": "ok",
        "demo_mode": settings.demo_mode,
        "kafka": {"producer": producer.connected, "consumer": consumer.connected},
        "cassandra": cass_status,
        "lstm": {"loaded": lstm_predictor.loaded,
                 "model": "lstm-v1" if lstm_predictor.loaded else "rule-based-fallback"},
    }
