"""Simulated probe traces with coordinate rounding and k-anonymity."""
import random


def generate_probe_trace(samples: int = 20, k: int = 5) -> list[dict]:
    traces = []
    base_lat, base_lng = 28.6137, 77.2090
    for _ in range(samples):
        lat = round(base_lat + random.uniform(-0.02, 0.02), 2)
        lng = round(base_lng + random.uniform(-0.02, 0.02), 2)
        traces.append({
            "probe_id": f"anonymous-k{k}",
            "lat": lat,
            "lng": lng,
            "speed": round(random.uniform(5, 80), 1),
        })
    return traces
