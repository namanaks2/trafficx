"""Measure response time for the traffic locations API on a running backend."""
import json
import os
import time

import httpx
import numpy as np


def run():
    base_url = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
    path = os.getenv("API_BENCH_PATH", "/api/traffic/locations")
    samples = int(os.getenv("API_BENCH_SAMPLES", "50"))
    warmup = int(os.getenv("API_BENCH_WARMUP", "5"))
    if samples < 1 or warmup < 0:
        raise SystemExit("API_BENCH_SAMPLES must be positive and API_BENCH_WARMUP non-negative")

    latencies = []
    sources = set()
    total_s = 0.0
    with httpx.Client(timeout=10) as client:
        health_response = client.get(f"{base_url}/health")
        health_response.raise_for_status()
        health = health_response.json()

        for _ in range(warmup):
            response = client.get(f"{base_url}{path}")
            response.raise_for_status()

        benchmark_started = time.perf_counter()
        for _ in range(samples):
            started = time.perf_counter()
            response = client.get(f"{base_url}{path}")
            elapsed_ms = (time.perf_counter() - started) * 1000
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, list):
                raise ValueError(f"{path} returned {type(data).__name__}; expected a list")
            sources.update(
                item["source"] for item in data
                if isinstance(item, dict) and isinstance(item.get("source"), str)
            )
            latencies.append(elapsed_ms)
        total_s = time.perf_counter() - benchmark_started
    result = {
        "status": "measured",
        "endpoint": path,
        "samples": len(latencies),
        "warmup_requests": warmup,
        "p50_ms": round(float(np.percentile(latencies, 50)), 2),
        "p95_ms": round(float(np.percentile(latencies, 95)), 2),
        "mean_ms": round(float(np.mean(latencies)), 2),
        "request_rate_per_s": round(len(latencies) / total_s, 2) if total_s else None,
        "traffic_sources": sorted(sources),
        "demo_mode": health.get("demo_mode"),
        "traffic_provider": health.get("traffic_provider", {}).get("name"),
    }
    os.makedirs("results", exist_ok=True)
    with open("results/bench_api.json", "w", encoding="utf-8") as file:
        json.dump(result, file, indent=2)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    run()
