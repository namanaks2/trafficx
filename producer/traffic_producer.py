"""
TrafficX Traffic Producer
Generates synthetic traffic events and publishes them to Kafka.
Runs as an independent Docker service.
"""
import asyncio
import json
import math
import os
import random
import uuid
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("producer")

try:
    from aiokafka import AIOKafkaProducer
    KAFKA_OK = True
except ImportError:
    KAFKA_OK = False

BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
INTERVAL  = float(os.getenv("PRODUCE_INTERVAL_SEC", "2"))

ROADS = [
    {"road_id": "R-001", "name": "Downtown Junction",   "zone": "zone-a", "lat": 40.7128, "lng": -74.0060},
    {"road_id": "R-002", "name": "Highway I-95 North",  "zone": "zone-b", "lat": 40.7580, "lng": -73.9855},
    {"road_id": "R-003", "name": "Bridge Crossing",     "zone": "zone-c", "lat": 40.6892, "lng": -74.0445},
    {"road_id": "R-004", "name": "Airport Expressway",  "zone": "zone-a", "lat": 40.6413, "lng": -73.7781},
    {"road_id": "R-005", "name": "Westside Boulevard",  "zone": "zone-b", "lat": 40.7549, "lng": -74.0025},
    {"road_id": "R-006", "name": "Financial District",  "zone": "zone-c", "lat": 40.7074, "lng": -74.0113},
]

# Per-road state for realistic drift
_state = {r["road_id"]: {"speed": 45.0, "vc": 300} for r in ROADS}


def generate_event(road: dict) -> dict:
    hour     = datetime.utcnow().hour
    is_rush  = (7 <= hour <= 9) or (17 <= hour <= 19)
    is_night = hour < 5 or hour > 22
    st       = _state[road["road_id"]]

    # Realistic drift
    target_speed = 22 if is_rush else 65 if is_night else 42
    target_vc    = 700 if is_rush else 120 if is_night else 380

    st["speed"] = st["speed"] * 0.85 + target_speed * 0.15 + random.gauss(0, 2)
    st["speed"] = max(5, min(120, st["speed"]))
    st["vc"]    = int(st["vc"] * 0.85 + target_vc * 0.15 + random.gauss(0, 25))
    st["vc"]    = max(5, min(1200, st["vc"]))

    cong = max(5, min(99, 100 - (st["speed"] / 80 * 100) + random.gauss(0, 2)))

    return {
        "event_id":        str(uuid.uuid4()),
        "road_id":         road["road_id"],
        "road_name":       road["name"],
        "zone":            road["zone"],
        "latitude":        road["lat"],
        "longitude":       road["lng"],
        "speed":           round(st["speed"], 1),
        "vehicle_count":   st["vc"],
        "congestion_level":round(cong, 1),
        "incident_score":  round(max(0, (cong - 70) / 30), 3),
        "event_type":      "observation",
        "timestamp":       datetime.utcnow().isoformat(),
        "source_node":     f"SENSOR-{road['road_id']}",
        "source":          "traffic-simulated",
        "is_simulated":    True,
    }


async def main():
    if not KAFKA_OK:
        logger.error("aiokafka not installed.")
        return

    kp = None
    for attempt in range(20):
        try:
            kp = AIOKafkaProducer(
                bootstrap_servers=BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v, default=str).encode(),
                key_serializer=lambda k: k.encode() if k else None,
                acks="all",
            )
            await kp.start()
            logger.info("Kafka producer connected → %s", BOOTSTRAP)
            break
        except Exception as e:
            logger.warning("Connect attempt %d/20: %s", attempt + 1, e)
            await asyncio.sleep(5)

    if kp is None:
        logger.error("Could not connect to Kafka after 20 attempts.")
        return

    tick = 0
    try:
        while True:
            for road in ROADS:
                evt = generate_event(road)
                await kp.send_and_wait("traffic.raw", value=evt, key=evt["road_id"])
            tick += 1
            if tick % 30 == 0:
                logger.info("Published %d rounds | sample speed=%.1f", tick, evt["speed"])
            await asyncio.sleep(INTERVAL)
    finally:
        await kp.stop()


if __name__ == "__main__":
    asyncio.run(main())
