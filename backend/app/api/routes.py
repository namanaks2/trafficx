"""Traffic-aware route search endpoints."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..core.config import settings
from ..integrations.adapters import (
    TomTomLocationNotFoundError,
    TomTomRoutingError,
    get_tomtom_routes,
    get_osrm_routes,
    geocode_locations,
)

router = APIRouter(prefix="/api/routes", tags=["routes"])


class RouteSearchRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=150)
    destination: str = Field(min_length=2, max_length=150)


@router.post("/")
async def search_routes(data: RouteSearchRequest):
    try:
        if settings.tomtom_api_key:
            try:
                return await get_tomtom_routes(
                    data.origin,
                    data.destination,
                    api_key=settings.tomtom_api_key,
                )
            except TomTomLocationNotFoundError:
                pass
            except TomTomRoutingError:
                pass

        return await get_osrm_routes(
            data.origin,
            data.destination,
            api_key=settings.tomtom_api_key,
        )
    except TomTomLocationNotFoundError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TomTomRoutingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/geocode")
async def geocode_route_location(q: str = Query(min_length=2, max_length=150)):
    try:
        locations = await geocode_locations(q, api_key=settings.tomtom_api_key, limit=6)
        return {"source": "tomtom" if settings.tomtom_api_key else "nominatim", "locations": locations}
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Location search is unavailable.") from exc
