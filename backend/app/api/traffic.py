"""Traffic data API endpoints"""
from fastapi import APIRouter
import random
from datetime import datetime

from ..ml.lstm_predictor import lstm_predictor
from ..network.ledger import ledger
from ..network.node import node_network

router = APIRouter(prefix="/api/traffic", tags=["traffic"])

LOCATIONS = [
    {"id": "node-001", "name": "Downtown Junction",      "lat": 40.7128, "lng": -74.0060, "zone": "Central", "node_id": "TXN-001"},
    {"id": "node-002", "name": "Highway I-95 North",     "lat": 40.7580, "lng": -73.9855, "zone": "North",   "node_id": "TXN-002"},
    {"id": "node-003", "name": "Bridge Crossing Alpha",  "lat": 40.6892, "lng": -74.0445, "zone": "South",   "node_id": "TXN-003"},
    {"id": "node-004", "name": "Airport Expressway",     "lat": 40.6413, "lng": -73.7781, "zone": "East",    "node_id": "TXN-004"},
    {"id": "node-005", "name": "Westside Boulevard",     "lat": 40.7549, "lng": -74.0025, "zone": "West",    "node_id": "TXN-005"},
]


def _get_live_reading(location: dict) -> dict:
    hour = datetime.utcnow().hour
    is_rush = (7 <= hour <= 9) or (17 <= hour <= 19)
    vehicle_count = random.randint(300, 850) if is_rush else random.randint(80, 400)
    avg_speed = random.randint(10, 25) if is_rush else random.randint(30, 65)
    congestion = max(5, min(99, 100 - (avg_speed / 80 * 100) + random.randint(-5, 5)))
    return {
        **location,
        "vehicle_count": vehicle_count,
        "avg_speed": avg_speed,
        "congestion": round(congestion, 1),
        "last_update": datetime.utcnow().isoformat(),
        "status": "active",
    }


@router.get("/locations")
async def get_locations():
    """Get all monitoring locations with live simulated readings."""
    return [_get_live_reading(loc) for loc in LOCATIONS]


@router.get("/summary")
async def get_summary():
    """Get city-wide traffic summary."""
    readings = [_get_live_reading(loc) for loc in LOCATIONS]
    avg_congestion = sum(r["congestion"] for r in readings) / len(readings)
    avg_speed = sum(r["avg_speed"] for r in readings) / len(readings)
    total_vehicles = sum(r["vehicle_count"] for r in readings)
    return {
        "avg_congestion": round(avg_congestion, 1),
        "avg_speed": round(avg_speed, 1),
        "total_vehicles": total_vehicles,
        "active_nodes": len(readings),
        "timestamp": datetime.utcnow().isoformat(),
        "is_demo": True,
    }


@router.get("/hourly")
async def get_hourly_data():
    """Get hourly traffic patterns for the last 24 hours."""
    data = []
    for i in range(24):
        is_rush = (7 <= i <= 9) or (17 <= i <= 19)
        is_night = i < 5 or i > 22
        base = 780 if is_rush else 120 if is_night else 420
        data.append({
            "hour": f"{i:02d}:00",
            "vehicles": max(50, base + random.randint(-40, 40)),
            "speed": 22 if is_rush else 65 if is_night else 45,
            "congestion": 75 if is_rush else 10 if is_night else 40,
        })
    return data


@router.get("/predict/{location_id}")
async def get_prediction(location_id: str):
    """
    Get LSTM congestion prediction (+15/+30/+60 min) for a location.
    Falls back to rule-based simulation when the LSTM window is not yet full
    (warming_up=true) or when the model is not loaded.
    Persistence baseline (current congestion) is always included for comparison.
    """
    loc = next((l for l in LOCATIONS if l["id"] == location_id), None)
    if not loc:
        return {"error": "Location not found"}

    reading = _get_live_reading(loc)
    current = reading["congestion"]

    # Build event for the LSTM predictor (uses TRAFFIC_TZ bucketing internally)
    event = {
        "road_id":       loc["id"],
        "timestamp":     datetime.utcnow().isoformat(),
        "speed":         float(reading["avg_speed"]),
        "vehicle_count": float(reading["vehicle_count"]),
    }
    lstm_result = lstm_predictor.predict(event)

    result = {
        "location":      loc["name"],
        "location_id":   loc["id"],
        "current":       current,
        "vehicle_count": reading["vehicle_count"],
        "avg_speed":     reading["avg_speed"],
        # LSTM predictions
        "predicted_15min": lstm_result.get("predicted_congestion_15", current),
        "predicted_30min": lstm_result.get("predicted_congestion_30", current),
        "predicted_60min": lstm_result.get("predicted_congestion_60", current),
        # Persistence baseline (naive: current congestion repeated)
        "persistence_15min": current,
        "persistence_30min": current,
        "persistence_60min": current,
        # Estimated 80% prediction intervals (gaussian ±1.28*RMSE, NOT empirically calibrated)
        "interval_80_15": lstm_result.get("interval_80_15"),
        "interval_80_30": lstm_result.get("interval_80_30"),
        "interval_80_60": lstm_result.get("interval_80_60"),
        # Metadata
        "model_version":   lstm_result.get("model_version", "rule-based-fallback"),
        "is_simulated":    lstm_result.get("is_simulated", True),
        "warming_up":      lstm_result.get("warming_up", False),
        "trained_on":      lstm_result.get("trained_on", "synthetic"),
        "timestamp":       datetime.utcnow().isoformat(),
    }

    # Record to ledger via a random online node
    online_nodes = node_network.get_online()
    if online_nodes:
        node = random.choice(online_nodes)
        entry = ledger.add_entry(
            node_id=node.id,
            location=loc["name"],
            observation={
                "vehicle_count": reading["vehicle_count"],
                "avg_speed":     reading["avg_speed"],
                "congestion":    current,
            },
        )
        confirmations = node_network.broadcast_observation(node.id, {"type": "prediction_query"})
        ledger.confirm_entry(entry.tx_id, len(confirmations))

    return result


@router.get("/predict")
async def get_all_predictions():
    """Get LSTM predictions for all monitored locations."""
    results = []
    for loc in LOCATIONS:
        reading = _get_live_reading(loc)
        current = reading["congestion"]
        event = {
            "road_id":       loc["id"],
            "timestamp":     datetime.utcnow().isoformat(),
            "speed":         float(reading["avg_speed"]),
            "vehicle_count": float(reading["vehicle_count"]),
        }
        lr = lstm_predictor.predict(event)
        results.append({
            "location_id":   loc["id"],
            "name":          loc["name"],
            "current":       current,
            "predicted_15min": lr.get("predicted_congestion_15", current),
            "predicted_30min": lr.get("predicted_congestion_30", current),
            "predicted_60min": lr.get("predicted_congestion_60", current),
            "persistence_15min": current,
            "model_version": lr.get("model_version", "rule-based-fallback"),
            "is_simulated":  lr.get("is_simulated", True),
            "warming_up":    lr.get("warming_up", False),
        })
    return results
