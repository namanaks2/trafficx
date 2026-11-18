import asyncio
import json
import sqlite3
from collections import OrderedDict, deque

import pytest
from fastapi import HTTPException

from nodes import edge_node


def _signed_payload(**overrides):
    payload = {
        "msg_id": "test-message",
        "origin": "TEST-ORIGIN",
        "sender_id": "TEST-ORIGIN",
        "sender_address": "test-peer:7001",
        "seq": 1,
        "ttl": 1,
        "summary": {"zone": "test-zone", "speed": 42.0},
        "prediction": {},
        "known_peers": {},
        "timestamp": "2025-01-01T00:00:00+00:00",
    }
    payload.update(overrides)
    payload["signature"] = edge_node.sign_payload(payload)
    return payload


@pytest.mark.asyncio
async def test_gossip_validates_signature_and_ttl_before_recording(monkeypatch):
    monkeypatch.setattr(edge_node, "seen_messages", OrderedDict())
    monkeypatch.setattr(edge_node, "peer_table", {})
    monkeypatch.setitem(edge_node.state, "recent_events", [])

    invalid_signature = _signed_payload(msg_id="bad-signature")
    invalid_signature["summary"]["speed"] = 1
    with pytest.raises(HTTPException) as error:
        await edge_node.receive_gossip(invalid_signature)
    assert error.value.status_code == 401
    assert not edge_node.seen_messages

    invalid_ttl = _signed_payload(msg_id="bad-ttl", ttl=True)
    with pytest.raises(HTTPException) as error:
        await edge_node.receive_gossip(invalid_ttl)
    assert error.value.status_code == 400
    assert not edge_node.seen_messages

    accepted = _signed_payload(msg_id="accepted")
    assert (await edge_node.receive_gossip(accepted))["ack"] is True
    assert (await edge_node.receive_gossip(accepted))["duplicate"] is True
    assert len(edge_node.state["recent_events"]) == 1


@pytest.mark.asyncio
async def test_spilled_kafka_events_replay_in_original_order(monkeypatch, tmp_path):
    class FakeProducer:
        def __init__(self):
            self.values = []

        async def send_and_wait(self, topic, value, key):
            self.values.append(json.loads(value))

    producer = FakeProducer()
    monkeypatch.setattr(edge_node, "kafka_buffer", deque(maxlen=2))
    monkeypatch.setattr(edge_node, "SPILL_PATH", str(tmp_path / "edge.db"))
    monkeypatch.setattr(edge_node, "kafka_producer", producer)
    monkeypatch.setattr(edge_node, "kafka_connected", True)
    monkeypatch.setattr(edge_node, "kafka_dropped", 0)

    for number in (1, 2, 3):
        edge_node.enqueue_kafka({"sequence": number})
    await edge_node.flush_kafka_buffer()

    assert [item["sequence"] for item in producer.values] == [1, 2, 3]
    assert not edge_node.kafka_buffer
    with sqlite3.connect(edge_node.SPILL_PATH) as connection:
        assert connection.execute("SELECT COUNT(*) FROM spill").fetchone()[0] == 0
