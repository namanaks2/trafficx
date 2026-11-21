"""
Optional external API adapters.
All adapters return simulated data when credentials are absent.
Never make external APIs mandatory for the application to start.
"""
import os, logging, math, random, asyncio
import re
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


async def geocode_locations(query: str, api_key: Optional[str] = None, limit: int = 5) -> list:
    key = api_key or os.getenv("TOMTOM_API_KEY")
    search_query = query.strip()
    if not search_query:
        return []

    async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "TrafficX/2.0"}) as client:
        if key:
            try:
                url = f"https://api.tomtom.com/search/2/search/{quote(search_query, safe='')}.json"
                payload = await _get_tomtom_json(
                    client,
                    url,
                    {"key": key, "countrySet": "IN", "limit": limit, "typeahead": "true"},
                )
                results = payload.get("results") if isinstance(payload, dict) else None
                if isinstance(results, list) and results:
                    locations = []
                    for result in results:
                        position = result.get("position") if isinstance(result, dict) else None
                        address = result.get("address") if isinstance(result, dict) else None
                        if not isinstance(position, dict):
                            continue
                        try:
                            lat = float(position["lat"])
                            lng = float(position["lon"])
                        except (KeyError, TypeError, ValueError):
                            continue
                        label = address.get("freeformAddress") if isinstance(address, dict) else search_query
                        locations.append({"label": label or search_query, "lat": lat, "lng": lng})
                    if locations:
                        return locations
            except TomTomRoutingError:
                pass

        payload = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": f"{search_query}, India", "format": "jsonv2", "addressdetails": 1, "limit": limit, "countrycodes": "in"},
        )
        payload.raise_for_status()
        results = payload.json()
    locations = []
    if isinstance(results, list):
        for result in results:
            try:
                lat = float(result["lat"])
                lng = float(result["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            locations.append({
                "label": result.get("display_name") or search_query,
                "lat": lat,
                "lng": lng,
            })
    return locations


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
    coordinate_match = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*", query)
    if coordinate_match:
        lat = float(coordinate_match.group(1))
        lng = float(coordinate_match.group(2))
        if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            raise TomTomRoutingError("TomTom received an invalid live location.")

        url = f"https://api.tomtom.com/search/2/reverseGeocode/{lat},{lng}.json"
        try:
            payload = await _get_tomtom_json(client, url, {"key": api_key})
            addresses = payload.get("addresses")
            address = addresses[0].get("address") if isinstance(addresses, list) and addresses else None
            label = address.get("freeformAddress") if isinstance(address, dict) else None
            if label:
                return {"query": query, "label": label, "lat": lat, "lng": lng}
        except TomTomRoutingError:
            pass

        reverse_payload = await client.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "jsonv2", "accept-language": "en"},
        )
        reverse_payload.raise_for_status()
        reverse_result = reverse_payload.json()
        label = reverse_result.get("display_name") if isinstance(reverse_result, dict) else None
        return {"query": query, "label": label or f"{lat:.6f},{lng:.6f}", "lat": lat, "lng": lng}

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
                "instructionsType": "text",
                "language": "en-US",
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

        instructions = []
        for leg in legs:
            for guidance in leg.get("guidance", {}).get("instructions", []):
                if not isinstance(guidance, dict):
                    continue
                text = guidance.get("message") or guidance.get("instruction")
                if text:
                    instructions.append({
                        "instruction": str(text),
                        "distance_m": float(guidance.get("routeOffsetInMeters", 0)),
                        "duration_s": 0,
                    })

        traffic_segments = []
        sections = route.get("sections")
        if isinstance(sections, list):
            for section in sections:
                if not isinstance(section, dict) or section.get("sectionType") != "TRAVEL_MODE":
                    if not isinstance(section, dict):
                        continue
                start_index = section.get("startPointIndex")
                end_index = section.get("endPointIndex")
                if not isinstance(start_index, int) or not isinstance(end_index, int):
                    continue
                start_index = max(0, min(start_index, len(coordinates) - 1))
                end_index = max(start_index + 1, min(end_index, len(coordinates) - 1))
                segment_coords = coordinates[start_index:end_index + 1]
                if len(segment_coords) < 2:
                    continue

                simple_category = str(section.get("simpleCategory") or "").upper()
                effective_speed = section.get("effectiveSpeedInKmh")
                congestion = 35
                if "BLOCKED" in simple_category or "JAM" in simple_category:
                    congestion = 90
                elif "CONGESTED" in simple_category or "HEAVY" in simple_category:
                    congestion = 75
                elif "SLOW" in simple_category:
                    congestion = 55
                elif isinstance(effective_speed, (int, float)):
                    congestion = max(10, min(95, round((1 - effective_speed / 80) * 100)))

                traffic_segments.append({
                    "coordinates": segment_coords,
                    "congestion": congestion,
                    "category": simple_category or "TRAFFIC",
                })

        routes.append({
            "id": f"tomtom-{index + 1}",
            "distance_m": distance_m,
            "travel_time_s": travel_time_s,
            "traffic_delay_s": traffic_delay_s,
            "coordinates": coordinates,
            "instructions": instructions,
            "traffic_segments": traffic_segments,
            "route_source": "TomTom",
        })

    if not routes:
        raise TomTomRoutingError("TomTom returned routes without usable map geometry.")
    routes.sort(key=lambda route: route["travel_time_s"])
    return {
        "source": "tomtom",
        "origin": origin,
        "destination": destination,
        "routes": routes,
    }


async def geocode_location(query: str, api_key: Optional[str] = None) -> dict:
    locations = await geocode_locations(query, api_key=api_key, limit=1)
    if not locations:
        raise TomTomLocationNotFoundError(f"Could not find '{query}' in India.")
    location = locations[0]
    return {
        "query": query,
        "label": location["label"],
        "lat": location["lat"],
        "lng": location["lng"],
    }


async def get_osrm_routes(origin_query: str, destination_query: str, api_key: Optional[str] = None) -> dict:
    key = api_key or os.getenv("TOMTOM_API_KEY")
    async with httpx.AsyncClient(timeout=12, headers={"User-Agent": "TrafficX/2.0"}) as client:
        origin = await geocode_location(origin_query, api_key)
        destination = await geocode_location(destination_query, api_key)
        url = (
            f"https://router.project-osrm.org/route/v1/driving/"
            f"{origin['lng']},{origin['lat']};{destination['lng']},{destination['lat']}"
        )
        response = await client.get(
            url,
            params={
                "alternatives": "true",
                "steps": "true",
                "geometries": "geojson",
                "overview": "full",
                "annotations": "duration,distance",
            },
        )
        response.raise_for_status()
        payload = response.json()

    provider_routes = payload.get("routes") if isinstance(payload, dict) else None
    if not isinstance(provider_routes, list) or not provider_routes:
        raise TomTomRoutingError("No drivable route was found for these locations.")

    routes = []
    for index, route in enumerate(provider_routes[:3]):
        if not isinstance(route, dict):
            continue
        geometry = route.get("geometry")
        coordinates_geo = geometry.get("coordinates") if isinstance(geometry, dict) else None
        if not isinstance(coordinates_geo, list) or len(coordinates_geo) < 2:
            continue

        coordinates = []
        for point in coordinates_geo:
            if not isinstance(point, list) or len(point) < 2:
                continue
            lng = float(point[0])
            lat = float(point[1])
            if math.isfinite(lat) and math.isfinite(lng):
                coordinates.append([lat, lng])

        distance_m = float(route.get("distance", 0))
        travel_time_s = float(route.get("duration", 0))
        instructions = []
        legs = route.get("legs")
        if isinstance(legs, list):
            for leg in legs:
                steps = leg.get("steps") if isinstance(leg, dict) else None
                if not isinstance(steps, list):
                    continue
                for step in steps:
                    if not isinstance(step, dict):
                        continue
                    maneuver = step.get("maneuver") if isinstance(step.get("maneuver"), dict) else {}
                    name = step.get("name")
                    instruction = str(maneuver.get("instruction") or "").strip()
                    if not instruction:
                        action = maneuver.get("type", "continue")
                        modifier = maneuver.get("modifier")
                        instruction = f"{action.replace('_', ' ').title()}"
                        if modifier:
                            instruction += f" {modifier}"
                        if name:
                            instruction += f" onto {name}"
                    if instruction:
                        instructions.append({
                            "instruction": instruction,
                            "distance_m": float(step.get("distance", 0)),
                            "duration_s": float(step.get("duration", 0)),
                        })

        if distance_m <= 0 or travel_time_s <= 0 or len(coordinates) < 2:
            continue

        traffic_segments = []
        if key:
            sample_count = min(8, len(coordinates))
            sample_indices = sorted(set(round(index * (len(coordinates) - 1) / max(1, sample_count - 1)) for index in range(sample_count)))
            sample_points = [coordinates[index] for index in sample_indices]
            flow_results = await asyncio.gather(*(
                get_tomtom_flow(point[0], point[1], key)
                for point in sample_points
            ))
            for sample_index, flow in enumerate(flow_results):
                if flow.get("source") != "tomtom":
                    continue
                free_speed = float(flow.get("freeFlowSpeed", 0))
                current_speed = float(flow.get("currentSpeed", 0))
                if free_speed <= 0:
                    continue
                congestion = round(max(0, min(100, (1 - current_speed / free_speed) * 100)))
                start_index = sample_indices[sample_index]
                end_index = sample_indices[min(sample_index + 1, len(sample_indices) - 1)]
                segment_coords = coordinates[start_index:end_index + 1]
                if len(segment_coords) < 2:
                    continue
                traffic_segments.append({
                    "coordinates": segment_coords,
                    "congestion": congestion,
                    "category": "Heavy traffic" if congestion >= 75 else "Moderate traffic" if congestion >= 55 else "Free-flow traffic",
                })

        routes.append({
            "id": f"osrm-{index + 1}",
            "distance_m": distance_m,
            "travel_time_s": travel_time_s,
            "traffic_delay_s": 0,
            "coordinates": coordinates,
            "instructions": instructions,
            "traffic_segments": traffic_segments,
            "route_source": "OSRM",
        })

    if not routes:
        raise TomTomRoutingError("Route geometry was unavailable.")
    routes.sort(key=lambda route: route["travel_time_s"])
    return {
        "source": "osrm",
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
