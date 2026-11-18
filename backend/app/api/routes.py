"""Traffic-aware route search endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..core.config import settings
from ..integrations.adapters import (
    TomTomLocationNotFoundError,
    TomTomRoutingError,
    get_tomtom_routes,
)

router = APIRouter(prefix="/api/routes", tags=["routes"])


class RouteSearchRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=150)
    destination: str = Field(min_length=2, max_length=150)


@router.post("/")
async def search_routes(data: RouteSearchRequest):
    if not settings.tomtom_api_key:
        raise HTTPException(
            status_code=503,
            detail="Configure TOMTOM_API_KEY on the backend to use live routing.",
        )
    try:
        return await get_tomtom_routes(
            data.origin,
            data.destination,
            api_key=settings.tomtom_api_key,
        )
    except TomTomLocationNotFoundError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TomTomRoutingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
