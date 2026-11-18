#!/usr/bin/env sh
set -e
mkdir -p results
python benchmarks/bench_gossip.py
python benchmarks/bench_api.py
python benchmarks/bench_e2e.py
echo "Fault benchmark is intentionally manual: run python benchmarks/bench_fault.py --execute after reviewing its container targets."
