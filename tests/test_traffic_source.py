import pytest

from backend.app.api import traffic
from producer.gps_probe_simulator import generate_probe_trace


@pytest.mark.asyncio
async def test_tomtom_readings_are_marked_live_without_inventing_vehicle_counts(monkeypatch):
    async def fake_flow(lat, lng, api_key=None):
        return {
            "source": "tomtom",
            "currentSpeed": 30,
            "freeFlowSpeed": 60,
            "confidence": 0.9,
        }

    monkeypatch.setattr(traffic.settings, "tomtom_api_key", "test-key")
    monkeypatch.setattr(traffic, "get_tomtom_flow", fake_flow)

    roads = await traffic.get_locations()
    summary = await traffic.get_summary()

    assert roads
    assert all(road["source"] == "tomtom" and road["is_simulated"] is False for road in roads)
    assert all(road["vehicle_count"] is None for road in roads)
    assert all(road["lat"] > 27 and road["lat"] < 30 for road in roads)
    assert summary["source"] == "tomtom"
    assert summary["is_demo"] is False
    assert summary["total_vehicles"] is None
    assert summary["avg_congestion"] == 50


@pytest.mark.asyncio
async def test_missing_provider_data_is_explicitly_labelled_simulated(monkeypatch):
    async def fake_flow(lat, lng, api_key=None):
        return {"source": "simulated", "reason": "provider unavailable"}

    monkeypatch.setattr(traffic.settings, "tomtom_api_key", None)
    monkeypatch.setattr(traffic, "get_tomtom_flow", fake_flow)

    roads = await traffic.get_locations()
    summary = await traffic.get_summary()

    assert roads
    assert all(road["source"] == "simulated" and road["is_simulated"] is True for road in roads)
    assert all(road["source_note"] == "provider unavailable" for road in roads)
    assert summary["source"] == "simulated"
    assert summary["is_demo"] is True


def test_gps_probe_publisher_only_emits_k_anonymous_rounded_cells():
    k = 5
    cells = generate_probe_trace(samples=1000, k=k, seed=3)

    assert cells
    assert all(cell["probe_count"] >= k for cell in cells)
    assert all(round(cell["lat"], 2) == cell["lat"] for cell in cells)
    assert all(round(cell["lng"], 2) == cell["lng"] for cell in cells)
