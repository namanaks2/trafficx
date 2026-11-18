"""
Optional external API adapters.
All adapters return simulated data when credentials are absent.
Never make external APIs mandatory for the application to start.
"""
import os, logging, math, random
from datetime import datetime
from typing import Optional
from urllib.parse import quote
import httpx

logger = logging.getLogger(__name__)

HERE_KEY       = os.getenv("HERE_API_KEY")
OPENWEATHER_KEY= os.getenv("OPENWEATHER_API_KEY")


class TomTomRoutingError(RuntimeError):
    pass


class TomTomLocationNotFoundError(TomTomRoutingError):
    pass


async def _get_tomtom_json(client: httpx.AsyncClient, url: str, params: dict) -> dict:
    try:
        response = await client.get(url, params=params)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        logger.warning("TomTom routing request failed (status=%s)", status)
        if status in (401, 403):
            raise TomTomRoutingError(
                "TomTom rejected the API key. Check that Search and Routing APIs are enabled."
            ) from exc
        if status == 429:
            raise TomTomRoutingError("TomTom API quota reached. Try again later.") from exc
        raise TomTomRoutingError("TomTom routing service returned an error.") from exc
    except httpx.HTTPError as exc:
        logger.warning("TomTom routing request could not be completed (%s)", type(exc).__name__)
        raise TomTomRoutingError("TomTom routing service could not be reached.") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise TomTomRoutingError("TomTom returned an invalid response.") from exc
    if not isinstance(payload, dict):
        raise TomTomRoutingError("TomTom returned an invalid response.")
    return payload


async def _geocode_tomtom(client: httpx.AsyncClient, query: str, api_key: str) -> dict:
    url = f"https://api.tomtom.com/search/2/geocode/{quote(query, safe='')}.json"
    payload = await _get_tomtom_json(
        client,
        url,
        {"key": api_key, "countrySet": "IN", "limit": 1},
    )
    results = payload.get("results")
    if not isinstance(results, list):
        raise TomTomRoutingError("TomTom returned invalid location results.")
    if not results:
        raise TomTomLocationNotFoundError(f"Could not find '{query}' in India.")

    result = results[0]
    position = result.get("position") if isinstance(result, dict) else None
    try:
        lat = float(position["lat"])
        lng = float(position["lon"])
    except (TypeError, KeyError, ValueError) as exc:
        raise TomTomRoutingError("TomTom returned an invalid location.") from exc
    if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise TomTomRoutingError("TomTom returned an invalid location.")

    address = result.get("address")
    label = address.get("freeformAddress") if isinstance(address, dict) else None
    return {"query": query, "label": label or query, "lat": lat, "lng": lng}


async def get_tomtom_routes(origin_query: str, destination_query: str, api_key: Optional[str] = None) -> dict:
    key = api_key or os.getenv("TOMTOM_API_KEY")
    if not key:
        raise TomTomRoutingError("TOMTOM_API_KEY is not configured on the backend.")

    async with httpx.AsyncClient(timeout=10) as client:
        origin = await _geocode_tomtom(client, origin_query.strip(), key)
        destination = await _geocode_tomtom(client, destination_query.strip(), key)
        locations = (
            f"{origin['lat']},{origin['lng']}:"
            f"{destination['lat']},{destination['lng']}"
        )
        url = f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json"
        payload = await _get_tomtom_json(
            client,
            url,
            {
                "key": key,
                "traffic": "true",
                "routeType": "fastest",
                "maxAlternatives": 2,
                "sectionType": "traffic",
            },
        )

    provider_routes = payload.get("routes")
    if not isinstance(provider_routes, list) or not provider_routes:
        raise TomTomRoutingError("TomTom could not find a drivable route for these locations.")

    routes = []
    for index, route in enumerate(provider_routes[:3]):
        if not isinstance(route, dict):
            continue
        summary = route.get("summary")
        legs = route.get("legs")
        if not isinstance(summary, dict) or not isinstance(legs, list):
            continue

        coordinates = []
        for leg in legs:
            if not isinstance(leg, dict):
                continue
            for point in leg.get("points", []):
                if not isinstance(point, dict):
                    continue
                try:
                    lat = float(point["latitude"])
                    lng = float(point["longitude"])
                except (KeyError, TypeError, ValueError):
                    continue
                if math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180:
                    coordinates.append([lat, lng])

        try:
            distance_m = float(summary["lengthInMeters"])
            travel_time_s = float(summary["travelTimeInSeconds"])
            traffic_delay_s = max(0, float(summary.get("trafficDelayInSeconds", 0)))
        except (KeyError, TypeError, ValueError):
            continue
        if len(coordinates) < 2 or not math.isfinite(distance_m) or not math.isfinite(travel_time_s):
            continue
        if distance_m <= 0 or travel_time_s <= 0:
            continue

        routes.append({
            "id": f"tomtom-{index + 1}",
            "distance_m": distance_m,
            "travel_time_s": travel_time_s,
            "traffic_delay_s": traffic_delay_s,
            "coordinates": coordinates,
        })

    if not routes:
        raise TomTomRoutingError("TomTom returned routes without usable map geometry.")
    return {
        "source": "tomtom",
        "origin": origin,
        "destination": destination,
        "routes": routes,
    }


# ── TomTom Traffic ────────────────────────────────────────────────────────────

async def get_tomtom_flow(lat: float, lng: float, api_key: Optional[str] = None) -> dict:
    key = api_key or os.getenv("TOMTOM_API_KEY")
    if not key:
        return {
            "source": "simulated",
            "reason": "TOMTOM_API_KEY is not configured",
            "freeFlowSpeed": 60,
            "currentSpeed": random.randint(20, 60),
            "confidence": 0.0,
        }
    url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            response = await c.get(url, params={"key": key, "point": f"{lat},{lng}"})
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("TomTom response was not an object")
            data = payload.get("flowSegmentData")
            if not data or data.get("currentSpeed") is None or data.get("freeFlowSpeed") is None:
                raise ValueError("TomTom response did not contain usable flow data")
            current_speed = float(data["currentSpeed"])
            free_flow_speed = float(data["freeFlowSpeed"])
            if not math.isfinite(current_speed) or not math.isfinite(free_flow_speed) or current_speed < 0 or free_flow_speed <= 0:
                raise ValueError("TomTom response contained invalid flow speeds")
            return {
                "source": "tomtom",
                "freeFlowSpeed": free_flow_speed,
                "currentSpeed": current_speed,
                "confidence": data.get("confidence", 0),
            }
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        logger.warning("TomTom traffic lookup failed (%s)", type(exc).__name__)
        return {"source": "simulated", "reason": "TomTom traffic lookup failed"}


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
