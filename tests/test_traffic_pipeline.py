import pytest

from backend.app.main import normalize_traffic_event
from backend.app.kafka.consumer import TrafficConsumer


def _event():
    return {
        "event_id": "event-001",
        "road_id": "road-001",
        "timestamp": "2025-01-01T10:00:00",
        "speed": 42.5,
        "vehicle_count": 220,
        "congestion_level": 51.2,
    }


def test_traffic_event_normalizes_timestamp_and_numeric_fields_to_utc():
    event = normalize_traffic_event(_event())

    assert event["timestamp"] == "2025-01-01T10:00:00+00:00"
    assert event["vehicle_count"] == 220
    assert event["event_type"] == "observation"
    assert event["source_node"] == "unknown"


@pytest.mark.parametrize(
    "changes",
    [
        {"event_id": ""},
        {"timestamp": "not-a-time"},
        {"speed": float("nan")},
        {"vehicle_count": 2.5},
        {"vehicle_count": True},
        {"congestion_level": 101},
    ],
)
def test_invalid_traffic_events_are_rejected(changes):
    with pytest.raises(ValueError):
        normalize_traffic_event({**_event(), **changes})


def test_consumer_tracks_a_bounded_set_of_event_ids():
    consumer = TrafficConsumer()

    assert not consumer._has_seen_event_id("event-001")
    consumer._remember_event_id("event-001")
    assert consumer._has_seen_event_id("event-001")
