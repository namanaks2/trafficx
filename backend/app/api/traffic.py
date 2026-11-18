"""Traffic data API endpoints"""
import asyncio
from fastapi import APIRouter
import random
from datetime import datetime

from ..core.config import settings
from ..integrations.adapters import get_tomtom_flow
from ..ml.lstm_predictor import lstm_predictor
from ..network.ledger import ledger
from ..network.node import node_network

router = APIRouter(prefix="/api/traffic", tags=["traffic"])

LOCATIONS = [
    {"id": "node-001", "name": "NH-48 Gurgaon",                  "lat": 28.4595, "lng": 77.0266, "zone": "Gurugram", "node_id": "TXN-001"},
    {"id": "node-002", "name": "DND Flyway",                     "lat": 28.5762, "lng": 77.3070, "zone": "Noida",    "node_id": "TXN-002"},
    {"id": "node-003", "name": "Delhi-Meerut Expressway",        "lat": 28.6710, "lng": 77.4520, "zone": "Ghaziabad","node_id": "TXN-003"},
    {"id": "node-004", "name": "Outer Ring Road",                "lat": 28.5672, "lng": 77.2100, "zone": "Delhi",    "node_id": "TXN-004"},
    {"id": "node-005", "name": "Noida-Greater Noida Expressway", "lat": 28.4670, "lng": 77.5040, "zone": "Noida",    "node_id": "TXN-005"},
]


def _get_simulated_reading(location: dict) -> dict:
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
        "source": "simulated",
        "is_simulated": True,
    }


async def _get_road_reading(location: dict) -> dict:
    flow = await get_tomtom_flow(
        location["lat"],
        location["lng"],
        api_key=settings.tomtom_api_key,
    )
    if flow["source"] == "tomtom":
        current_speed = float(flow["currentSpeed"])
        free_flow_speed = float(flow["freeFlowSpeed"])
        congestion = max(0, min(100, (1 - current_speed / free_flow_speed) * 100)) if free_flow_speed > 0 else 0
        return {
            **location,
            "vehicle_count": None,
            "avg_speed": round(current_speed, 1),
            "free_flow_speed": round(free_flow_speed, 1),
            "congestion": round(congestion, 1),
            "last_update": datetime.utcnow().isoformat(),
            "status": "active",
            "source": "tomtom",
            "is_simulated": False,
            "confidence": flow.get("confidence"),
        }

    reading = _get_simulated_reading(location)
    if flow.get("reason"):
        reading["source_note"] = flow["reason"]
    return reading


@router.get("/locations")
async def get_locations():
    """Get current road readings, using TomTom when configured and simulation otherwise."""
    return await asyncio.gather(*(_get_road_reading(loc) for loc in LOCATIONS))


@router.get("/summary")
async def get_summary():
    """Summarize current monitored roads and report whether data is simulated."""
    readings = await get_locations()
    avg_congestion = sum(r["congestion"] for r in readings) / len(readings)
    avg_speed = sum(r["avg_speed"] for r in readings) / len(readings)
    vehicle_counts = [r["vehicle_count"] for r in readings if r["vehicle_count"] is not None]
    live_roads = sum(not r["is_simulated"] for r in readings)
    source = "tomtom" if live_roads == len(readings) else "mixed" if live_roads else "simulated"
    return {
        "avg_congestion": round(avg_congestion, 1),
        "avg_speed": round(avg_speed, 1),
        "total_vehicles": sum(vehicle_counts) if vehicle_counts else None,
        "active_nodes": len(readings),
        "live_roads": live_roads,
        "source": source,
        "timestamp": datetime.utcnow().isoformat(),
        "is_demo": live_roads == 0,
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
            "source": "simulated",
            "is_simulated": True,
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

    reading = _get_simulated_reading(loc)
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
        reading = _get_simulated_reading(loc)
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
