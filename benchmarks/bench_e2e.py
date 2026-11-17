import json

with open("results/bench_e2e.json", "w") as f:
    json.dump({"status": "requires_running_stack", "p50_ms": None, "p95_ms": None, "throughput_msgs_s": None}, f)
