import json
import os
import numpy as np

os.makedirs("results", exist_ok=True)
all_results = []
for count in (3, 6, 12):
    latencies = np.clip(30.0 + count * 1.7 + np.random.default_rng(count).normal(0, 4, 100), 1, None)
    doc = {"nodes": count, "p50_ms": round(float(np.percentile(latencies, 50)), 2),
           "p95_ms": round(float(np.percentile(latencies, 95)), 2), "simulated": True}
    all_results.append(doc)
    print(json.dumps(doc))
with open("results/bench_gossip.json", "w") as f:
    json.dump({"status": "generated_placeholder", "note": "Run against Docker network for real measurements", "results": all_results}, f)
