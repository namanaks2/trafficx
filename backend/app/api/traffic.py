"""Traffic data API endpoints"""
from fastapi import APIRouter, Query
from typing import Optional
import random
import math
from datetime import datetime, timedelta

from ..ml.predict import predict_congestion
from ..network.ledger import ledger
from ..network.node import node_network

router = APIRouter(prefix="/api/traffic", tags=["traffic"])

# Simulated monitoring locations
LOCATIONS = [
    {"id": "node-001", "name": "Downtown Junction", "lat": 40.7128, "lng": -74.006, "zone": "Central", "node_id": "TXN-001"},
    {"id": "node-002", "name": "Highway I-95 North", "lat": 40.7580, "lng": -73.9855, "zone": "North", "node_id": "TXN-002"},
    {"id": "node-003", "name": "Bridge Crossing Alpha", "lat": 40.6892, "lng": -74.0445, "zone": "South", "node_id": "TXN-003"},
    {"id": "node-004", "name": "Airport Expressway", "lat": 40.6413, "lng": -73.7781, "zone": "East", "node_id": "TXN-004"},
    {"id": "node-005", "name": "Westside Boulevard", "lat": 40.7549, "lng": -74.0025, "zone": "West", "node_id": "TXN-005"},
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
    """Get all monitoring locations with live readings."""
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
        hour = i
        is_rush = (7 <= hour <= 9) or (17 <= hour <= 19)
        is_night = hour < 5 or hour > 22
        base = 780 if is_rush else 120 if is_night else 420
        data.append({
            "hour": f"{hour:02d}:00",
            "vehicles": max(50, base + random.randint(-40, 40)),
            "speed": 22 if is_rush else 65 if is_night else 45,
            "congestion": 75 if is_rush else 10 if is_night else 40,
        })
    return data


@router.get("/predict/{location_id}")
async def get_prediction(location_id: str):
    """Get ML congestion prediction for a location."""
    loc = next((l for l in LOCATIONS if l["id"] == location_id), None)
    if not loc:
        return {"error": "Location not found"}
    reading = _get_live_reading(loc)
    result = predict_congestion(
        vehicle_count=reading["vehicle_count"],
        avg_speed=reading["avg_speed"],
        location=loc["name"],
    )
    # Submit to ledger
    online_nodes = node_network.get_online()
    if online_nodes:
        import random as rnd
        node = rnd.choice(online_nodes)
        entry = ledger.add_entry(
            node_id=node.id,
            location=loc["name"],
            observation={"vehicle_count": reading["vehicle_count"], "avg_speed": reading["avg_speed"], "congestion": reading["congestion"]}
        )
        confirmations = node_network.broadcast_observation(node.id, {"type": "prediction_query"})
        ledger.confirm_entry(entry.tx_id, len(confirmations))
    return result
