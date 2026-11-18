"""Measure sensor-event to backend WebSocket latency through Kafka."""
import asyncio
import json
import os
import time
import uuid
from datetime import datetime, timezone

import httpx
import numpy as np
import websockets
from aiokafka import AIOKafkaProducer


async def run():
    parser_count = int(os.getenv("E2E_BENCH_COUNT", "100"))
    bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    api_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    websocket_url = os.getenv("BACKEND_WS_URL", "ws://localhost:8000/ws/traffic")
    timeout = float(os.getenv("E2E_BENCH_TIMEOUT_SEC", "15"))
    async with httpx.AsyncClient(timeout=5) as client:
        health_response = await client.get(f"{api_url}/health")
        health_response.raise_for_status()
        health = health_response.json()
        if not health.get("cassandra", {}).get("connected"):
            raise SystemExit("Cassandra is not connected; this benchmark measures the complete Kafka-to-Cassandra-to-WebSocket path.")

    pending = {}
    latencies = []
    started_all = time.perf_counter()
    async with websockets.connect(websocket_url, ping_interval=20) as ws:
        producer = AIOKafkaProducer(
            bootstrap_servers=bootstrap,
            value_serializer=lambda value: json.dumps(value, default=str).encode(),
        )
        await producer.start()
        try:
            for _ in range(parser_count):
                event_id = str(uuid.uuid4())
                event = {
                    "event_id": event_id,
                    "road_id": "BENCH-ROAD-001",
                    "road_name": "TrafficX benchmark",
                    "zone": "benchmark",
                    "speed": 42.0,
                    "vehicle_count": 250,
                    "congestion_level": 47.5,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "source_node": "BENCHMARK",
                }
                started = time.perf_counter()
                pending[event_id] = started
                await producer.send_and_wait("traffic.raw", value=event, key="BENCH-ROAD-001")

            deadline = time.perf_counter() + timeout
            while pending and time.perf_counter() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=max(0.1, deadline - time.perf_counter()))
                except asyncio.TimeoutError:
                    break
                message = json.loads(raw)
                event_id = message.get("data", {}).get("event_id")
                if message.get("type") == "traffic" and event_id in pending:
                    latencies.append((time.perf_counter() - pending.pop(event_id)) * 1000)
        finally:
            await producer.stop()

    elapsed = time.perf_counter() - started_all
    if not latencies:
        raise SystemExit("No benchmark events reached the WebSocket; verify Kafka consumer, Cassandra, and backend connectivity.")
    output = {
        "status": "measured",
        "sent": parser_count,
        "delivered": len(latencies),
        "lost_or_timed_out": parser_count - len(latencies),
        "p50_ms": round(float(np.percentile(latencies, 50)), 2),
        "p95_ms": round(float(np.percentile(latencies, 95)), 2),
        "throughput_msgs_s": round(len(latencies) / elapsed, 2),
        "simulated": False,
    }
    os.makedirs("results", exist_ok=True)
    with open("results/bench_e2e.json", "w", encoding="utf-8") as file:
        json.dump(output, file, indent=2)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
