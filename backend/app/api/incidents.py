"""Incident management API endpoints"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

# In-memory store for demo
_incidents: List[dict] = [
    {
        "id": "INC-2024-001",
        "type": "accident",
        "title": "Multi-vehicle collision",
        "description": "Two-vehicle collision blocking left lane.",
        "location": "Downtown Junction, Main St & 5th Ave",
        "lat": 40.7128, "lng": -74.006,
        "severity": "critical",
        "status": "responding",
        "reported_by": "TXN-001",
        "reported_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "assigned_to": "Traffic Authority Unit 7",
        "affected_lanes": 2,
        "estimated_clearance": "45 minutes",
    },
    {
        "id": "INC-2024-002",
        "type": "congestion",
        "title": "Severe traffic jam",
        "description": "Unexpected congestion due to lane reduction.",
        "location": "Westside Boulevard near Exit 12",
        "lat": 40.7549, "lng": -74.0025,
        "severity": "high",
        "status": "verified",
        "reported_by": "TXN-005",
        "reported_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "assigned_to": None,
        "affected_lanes": 1,
        "estimated_clearance": "2 hours",
    },
]


class IncidentCreate(BaseModel):
    type: str
    title: str
    description: Optional[str] = None
    location: str
    lat: Optional[float] = 40.7128
    lng: Optional[float] = -74.006
    severity: str = "medium"
    reported_by: Optional[str] = "user"


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    description: Optional[str] = None
    estimated_clearance: Optional[str] = None


@router.get("/")
async def list_incidents(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
):
    result = _incidents
    if status:
        result = [i for i in result if i["status"] == status]
    if severity:
        result = [i for i in result if i["severity"] == severity]
    return result


@router.post("/")
async def create_incident(data: IncidentCreate):
    incident = {
        "id": f"INC-{uuid.uuid4().hex[:8].upper()}",
        **data.dict(),
        "status": "reported",
        "reported_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "assigned_to": None,
        "affected_lanes": 0,
        "estimated_clearance": "Unknown",
    }
    _incidents.insert(0, incident)
    return incident


@router.get("/{incident_id}")
async def get_incident(incident_id: str):
    incident = next((i for i in _incidents if i["id"] == incident_id), None)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.patch("/{incident_id}")
async def update_incident(incident_id: str, data: IncidentUpdate):
    incident = next((i for i in _incidents if i["id"] == incident_id), None)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    updates = data.dict(exclude_none=True)
    incident.update({**updates, "updated_at": datetime.utcnow().isoformat()})
    return incident
