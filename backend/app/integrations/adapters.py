"""
Optional external API adapters.
All adapters return simulated data when credentials are absent.
Never make external APIs mandatory for the application to start.
"""
import os, logging, math, random
from datetime import datetime
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

TOMTOM_KEY     = os.getenv("TOMTOM_API_KEY")
HERE_KEY       = os.getenv("HERE_API_KEY")
OPENWEATHER_KEY= os.getenv("OPENWEATHER_API_KEY")


# ── TomTom Traffic ────────────────────────────────────────────────────────────

async def get_tomtom_flow(lat: float, lng: float) -> dict:
    if not TOMTOM_KEY:
        return {"source": "simulated", "freeFlowSpeed": 60, "currentSpeed": random.randint(20, 60), "confidence": 0.0}
    url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key={TOMTOM_KEY}&point={lat},{lng}"
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(url)
            d = r.json().get("flowSegmentData", {})
            return {"source": "tomtom", "freeFlowSpeed": d.get("freeFlowSpeed"), "currentSpeed": d.get("currentSpeed"), "confidence": d.get("confidence", 0)}
    except Exception as e:
        logger.warning("TomTom error: %s", e)
        return {"source": "simulated", "error": str(e)}


# ── HERE Traffic ──────────────────────────────────────────────────────────────

async def get_here_incidents(lat: float, lng: float, radius_m: int = 2000) -> list:
    if not HERE_KEY:
        return [{"source": "simulated", "type": "CONGESTION", "description": "Simulated congestion"}]
    url = (f"https://data.traffic.hereapi.com/v7/incidents?locationReferencing=olr"
           f"&in=circle:{lat},{lng};r={radius_m}&apiKey={HERE_KEY}")
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(url)
            return r.json().get("results", [])
    except Exception as e:
        logger.warning("HERE error: %s", e)
        return []


# ── OpenWeather ───────────────────────────────────────────────────────────────

async def get_weather(lat: float, lng: float) -> dict:
    if not OPENWEATHER_KEY:
        conditions = ["Clear", "Cloudy", "Rain", "Fog"]
        return {"source": "simulated", "condition": random.choice(conditions), "temp_c": round(random.uniform(5, 35), 1), "wind_kmh": random.randint(0, 60)}
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&appid={OPENWEATHER_KEY}&units=metric"
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(url)
            d = r.json()
            return {
                "source":    "openweather",
                "condition": d.get("weather", [{}])[0].get("main", "unknown"),
                "temp_c":    d.get("main", {}).get("temp"),
                "wind_kmh":  round(d.get("wind", {}).get("speed", 0) * 3.6, 1),
            }
    except Exception as e:
        logger.warning("OpenWeather error: %s", e)
        return {"source": "simulated", "error": str(e)}


# ── OSRM Routing ──────────────────────────────────────────────────────────────

async def get_route(origin_lat, origin_lng, dest_lat, dest_lng) -> dict:
    url = f"http://router.project-osrm.org/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=false"
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(url)
            d = r.json()
            route = d.get("routes", [{}])[0]
            return {
                "source":        "osrm",
                "distance_m":    route.get("distance"),
                "duration_s":    route.get("duration"),
                "legs":          len(route.get("legs", [])),
            }
    except Exception as e:
        return {"source": "simulated", "error": str(e), "distance_m": 5000, "duration_s": 600}
