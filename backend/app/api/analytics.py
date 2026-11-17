from fastapi import APIRouter
from ..db.cassandra_client import cassandra
from ..ml.lstm_predictor import lstm_predictor

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/model-metrics")
async def model_metrics():
    return {
        "lstm": lstm_predictor.get_metrics(),
        "loaded": lstm_predictor.loaded,
        "model_version": "lstm-v1" if lstm_predictor.loaded else "rule-based-fallback",
    }

@router.get("/cassandra/traffic/{road_id}")
async def cassandra_traffic(road_id: str, limit: int = 50):
    rows = cassandra.get_recent_traffic(road_id, limit)
    return {"road_id": road_id, "records": len(rows), "data": rows, "source": "cassandra" if cassandra.connected else "unavailable"}

@router.get("/cassandra/predictions/{road_id}")
async def cassandra_predictions(road_id: str, limit: int = 10):
    rows = cassandra.get_predictions(road_id, limit)
    return {"road_id": road_id, "records": len(rows), "data": rows}

@router.get("/cassandra/incidents/{zone}")
async def cassandra_incidents(zone: str, limit: int = 20):
    rows = cassandra.get_incidents_by_zone(zone, limit)
    return {"zone": zone, "records": len(rows), "data": rows}
