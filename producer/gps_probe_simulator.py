"""Generate anonymous, rounded probe aggregates with a k-anonymity floor."""
import asyncio
import random
from collections import defaultdict
from datetime import datetime, timezone

try:
    from .kafka_utils import connect_producer, publish_json
except ImportError:
    from kafka_utils import connect_producer, publish_json


def generate_probe_trace(samples: int = 100, k: int = 5, seed: int | None = None) -> list[dict]:
    if samples < 0 or k < 2:
        raise ValueError("samples must be non-negative and k must be at least 2")
    rng = random.Random(seed)
    centers = [(28.61 + i * 0.01, 77.20 + i * 0.01) for i in range(4)]
    cells = defaultdict(list)
    for index in range(samples):
        lat, lng = centers[index % len(centers)]
        raw_lat = lat + rng.uniform(-0.002, 0.002)
        raw_lng = lng + rng.uniform(-0.002, 0.002)
        cells[(round(raw_lat, 2), round(raw_lng, 2))].append(rng.uniform(5, 80))

    return [
        {
            "lat": lat,
            "lng": lng,
            "probe_count": len(speeds),
            "mean_speed": round(sum(speeds) / len(speeds), 1),
            "k_anonymity": k,
        }
        for (lat, lng), speeds in cells.items()
        if len(speeds) >= k
    ]


async def main():
    producer = await connect_producer()
    try:
        while True:
            for cell in generate_probe_trace():
                event = {
                    **cell,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "source": "gps-simulated",
                }
                key = f"{cell['lat']:.2f},{cell['lng']:.2f}"
                await publish_json(producer, "traffic.gps", key, event)
            await asyncio.sleep(10)
    finally:
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(main())
