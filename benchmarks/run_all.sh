#!/usr/bin/env sh
set -e
mkdir -p results
python benchmarks/bench_gossip.py
python benchmarks/bench_e2e.py
python benchmarks/bench_fault.py
