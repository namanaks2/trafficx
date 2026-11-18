import httpx
import pytest
from fastapi import HTTPException

from backend.app.api import routes as routes_api
from backend.app.integrations import adapters


@pytest.mark.asyncio
async def test_tomtom_route_adapter_geocodes_and_parses_live_routes(monkeypatch):
    requests = []

    class MockClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url, params):
            requests.append((url, params))
            if "/search/2/geocode/" in url:
                query = url.split("/geocode/", 1)[1].removesuffix(".json")
                lat = 28.6 if "Delhi" in query else 28.5
                payload = {
                    "results": [{
                        "position": {"lat": lat, "lon": 77.2},
                        "address": {"freeformAddress": query},
                    }]
                }
            else:
                payload = {
                    "routes": [{
                        "summary": {
                            "lengthInMeters": 12000,
                            "travelTimeInSeconds": 1800,
                            "trafficDelayInSeconds": 240,
                        },
                        "legs": [{
                            "points": [
                                {"latitude": 28.6, "longitude": 77.2},
                                {"latitude": 28.5, "longitude": 77.2},
                            ]
                        }],
                    }]
                }
            return httpx.Response(
                200,
                json=payload,
                request=httpx.Request("GET", url),
            )

    monkeypatch.setattr(adapters.httpx, "AsyncClient", lambda timeout: MockClient())

    result = await adapters.get_tomtom_routes("Delhi", "Gurugram", "test-key")

    assert result["source"] == "tomtom"
    assert result["origin"]["lat"] == 28.6
    assert result["destination"]["lat"] == 28.5
    assert result["routes"][0] == {
        "id": "tomtom-1",
        "distance_m": 12000,
        "travel_time_s": 1800,
        "traffic_delay_s": 240,
        "coordinates": [[28.6, 77.2], [28.5, 77.2]],
    }
    assert len(requests) == 3
    assert requests[-1][1]["traffic"] == "true"
    assert requests[-1][1]["maxAlternatives"] == 2


@pytest.mark.asyncio
async def test_route_endpoint_requires_backend_tomtom_key(monkeypatch):
    monkeypatch.setattr(routes_api.settings, "tomtom_api_key", None)

    with pytest.raises(HTTPException) as exc:
        await routes_api.search_routes(
            routes_api.RouteSearchRequest(origin="Delhi", destination="Gurugram")
        )

    assert exc.value.status_code == 503
    assert "TOMTOM_API_KEY" in exc.value.detail
