"""Measure real message propagation through already-running edge nodes.

Set GOSSIP_NODE_SETS as `3=url,url,url;6=url,...;12=url,...` to measure
separate running Docker topologies. Results are not simulated.
"""
import asyncio
import hashlib
import hmac
import json
import os
import time
import uuid

import httpx
import numpy as np


def _sets_from_env():
    raw = os.getenv("GOSSIP_NODE_SETS", "")
    sets = {}
    for group in raw.split(";"):
        if not group.strip():
            continue
        size, urls = group.split("=", 1)
        values = [url.strip().rstrip("/") for url in urls.split(",") if url.strip()]
        if len(values) != int(size):
            raise ValueError(f"Configured node set {size} has {len(values)} URLs")
        sets[int(size)] = values
    return sets


def _signed_message(secret: str, message_id: str) -> dict:
    payload = {
        "msg_id": message_id,
        "origin": "BENCHMARK",
        "sender_id": "BENCHMARK",
        "sender_address": "benchmark-client.invalid",
        "seq": 1,
        "ttl": 20,
        "summary": {"source": "benchmark", "timestamp": time.time()},
        "prediction": {"source": "benchmark"},
        "known_peers": {},
        "timestamp": time.time(),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
    payload["signature"] = hmac.new(secret.encode(), canonical, hashlib.sha256).hexdigest()
    return payload


async def _measure(urls: list[str], trials: int, timeout: float):
    secret = os.getenv("NETWORK_SECRET", "change-me-in-production")
    values = []
    async with httpx.AsyncClient(timeout=3) as client:
        for _ in range(trials):
            message_id = str(uuid.uuid4())
            message = _signed_message(secret, message_id)
            started = time.perf_counter()
            response = await client.post(f"{urls[0]}/gossip", json=message)
            response.raise_for_status()
            deadline = started + timeout
            reached = set()
            while time.perf_counter() < deadline and len(reached) < len(urls):
                for index, url in enumerate(urls):
                    if index in reached:
                        continue
                    result = await client.get(f"{url}/state")
                    result.raise_for_status()
                    events = result.json().get("recent_events", [])
                    if any(item.get("msg_id") == message_id for item in events):
                        reached.add(index)
                if len(reached) < len(urls):
                    await asyncio.sleep(0.1)
            if len(reached) != len(urls):
                raise TimeoutError(
                    f"Message reached {len(reached)}/{len(urls)} nodes in {timeout}s"
                )
            values.append((time.perf_counter() - started) * 1000)
    return {
        "nodes": len(urls),
        "trials": trials,
        "p50_ms": round(float(np.percentile(values, 50)), 2),
        "p95_ms": round(float(np.percentile(values, 95)), 2),
        "simulated": False,
    }


async def run():
    parser_trials = int(os.getenv("GOSSIP_BENCH_TRIALS", "20"))
    timeout = float(os.getenv("GOSSIP_BENCH_TIMEOUT_SEC", "30"))
    topologies = _sets_from_env()
    if not topologies:
        raise SystemExit(
            "Set GOSSIP_NODE_SETS, e.g. '3=http://localhost:7001,http://localhost:7002,http://localhost:7003'."
        )
    results = [await _measure(urls, parser_trials, timeout) for _, urls in sorted(topologies.items())]
    os.makedirs("results", exist_ok=True)
    output = {"status": "measured", "results": results}
    with open("results/bench_gossip.json", "w", encoding="utf-8") as file:
        json.dump(output, file, indent=2)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
