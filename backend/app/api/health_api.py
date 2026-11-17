from fastapi import APIRouter
from ..db.cassandra_client import cassandra
from ..kafka.producer import producer
from ..kafka.consumer import consumer
from ..ml.lstm_predictor import lstm_predictor

router = APIRouter(prefix="/api/health", tags=["health"])

@router.get("/")
async def full_health():
    return {
        "api":       "ok",
        "kafka":     {"producer": producer.connected, "consumer": consumer.connected},
        "cassandra": cassandra.status(),
        "lstm":      {"loaded": lstm_predictor.loaded, "model": "lstm-v2" if lstm_predictor.loaded else "rule-based-fallback"},
    }

