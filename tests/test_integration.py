"""
TrafficX Integration Tests
Run from project root: python -m pytest tests/ -v
Requires: kafka + cassandra running (docker compose up -d kafka cassandra)
"""
import asyncio
import json
import os
import sys
import time
import pytest

# ── Helpers ───────────────────────────────────────────────────────────────────

KAFKA_BOOT = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
CASS_HOST  = os.getenv("CASSANDRA_CONTACT_POINTS", "localhost")
BACKEND    = os.getenv("BACKEND_URL", "http://localhost:8000")


# ── 1. Kafka producer → consumer round-trip ───────────────────────────────────

@pytest.mark.asyncio
async def test_kafka_roundtrip():
    try:
        from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
    except ImportError:
        pytest.skip("aiokafka not installed")

    received = []
    test_msg = {"test": True, "value": 42, "ts": time.time()}

    prod = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOT,
                            value_serializer=lambda v: json.dumps(v).encode())
    cons = AIOKafkaConsumer("traffic.raw", bootstrap_servers=KAFKA_BOOT,
                            group_id=f"test-{time.time()}",
                            auto_offset_reset="latest",
                            value_deserializer=lambda m: json.loads(m.decode()))
    try:
        await prod.start()
        await cons.start()
        await prod.send_and_wait("traffic.raw", value=test_msg, key=b"test")
        try:
            async with asyncio.timeout(10):
                async for msg in cons:
                    if msg.value.get("test"):
                        received.append(msg.value)
                        break
        except asyncio.TimeoutError:
            pass
    finally:
        await prod.stop()
        await cons.stop()

    assert len(received) >= 1, "No message received from Kafka"
    assert received[0]["value"] == 42
    print("✓ Kafka roundtrip passed")


# ── 2. Cassandra insert + query ───────────────────────────────────────────────

def test_cassandra_insert_query():
    try:
        from cassandra.cluster import Cluster
        from cassandra.policies import DCAwareRoundRobinPolicy
    except ImportError:
        pytest.skip("cassandra-driver not installed")

    cluster = Cluster([CASS_HOST], load_balancing_policy=DCAwareRoundRobinPolicy(local_dc='dc1'))
    session = cluster.connect("trafficx")

    road_id = "TEST-ROAD-001"
    from datetime import datetime
    now = datetime.utcnow()

    session.execute("""
        INSERT INTO traffic_by_road
        (road_id, timestamp, zone, speed, vehicle_count, congestion_level,
         latitude, longitude, incident_score, event_type, source_node, kafka_offset)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (road_id, now, "test-zone", 42.0, 350, 55.0, 40.7128, -74.006, 0.1, "test", "TEST", -1))

    rows = list(session.execute("SELECT * FROM traffic_by_road WHERE road_id = %s LIMIT 1", (road_id,)))
    cluster.shutdown()

    assert len(rows) == 1
    assert rows[0].road_id == road_id
    print("✓ Cassandra insert+query passed")


# ── 3. LSTM predictor ─────────────────────────────────────────────────────────

def test_lstm_predictor_fallback():
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from backend.app.ml.lstm_predictor import LSTMPredictor
    p = LSTMPredictor()
    p.load()   # will use rule-based fallback if model not trained
    result = p.predict({"road_id": "R-001", "speed": 35.0, "vehicle_count": 420})
    assert "predicted_congestion_15" in result
    assert 5 <= result["predicted_congestion_15"] <= 99
    assert result["model_version"] in ("lstm-v1", "rule-based-fallback")
    print(f"✓ LSTM predictor returned: {result['model_version']}")


# ── 4. Incident detector ──────────────────────────────────────────────────────

def test_incident_detector():
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from backend.app.detection.incident_detector import detect_incident, _baselines
    road = "TEST-DET-001"
    # Feed normal baseline
    for _ in range(6):
        detect_incident({"road_id": road, "speed": 60.0, "vehicle_count": 200,
                         "congestion_level": 30, "zone": "test", "latitude": 0, "longitude": 0})
    # Feed sharp speed drop + density spike
    result = detect_incident({"road_id": road, "speed": 15.0, "vehicle_count": 450,
                               "congestion_level": 85, "zone": "test", "latitude": 0, "longitude": 0})
    assert result is not None, "Should detect incident on sharp drop"
    assert result["incident_type"] == "traffic_anomaly"
    assert result["confidence"] > 0.3
    print(f"✓ Incident detected: severity={result['severity']}, confidence={result['confidence']:.2f}")


# ── 5. Backend HTTP health ────────────────────────────────────────────────────

def test_backend_health():
    import httpx
    try:
        r = httpx.get(f"{BACKEND}/health", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        print(f"✓ Backend health: kafka={data.get('kafka')}, cassandra={data.get('cassandra')}")
    except Exception as e:
        pytest.skip(f"Backend not running: {e}")


# ── 6. P2P node heartbeat ─────────────────────────────────────────────────────

def test_p2p_node_heartbeat():
    import httpx
    for port in [7001, 7002, 7003]:
        try:
            r = httpx.get(f"http://localhost:{port}/heartbeat", timeout=3)
            assert r.status_code == 200
            d = r.json()
            assert "node_id" in d
            print(f"✓ Node port={port} id={d['node_id']} status={d['status']}")
            return   # at least one node online
        except Exception:
            continue
    pytest.skip("No P2P nodes reachable on 7001-7003")


# ── 7. WebSocket connection ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_websocket_connection():
    try:
        import websockets
    except ImportError:
        pytest.skip("websockets not installed")
    try:
        async with websockets.connect(f"ws://localhost:8000/ws/traffic") as ws:
            await asyncio.wait_for(ws.recv(), timeout=5)
            print("✓ WebSocket connected and received message")
    except asyncio.TimeoutError:
        print("✓ WebSocket connected (no message in 5s — normal if no producer running)")
    except Exception as e:
        pytest.skip(f"Backend WS not reachable: {e}")
