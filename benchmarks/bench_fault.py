"""Measure edge-node and Kafka failure detection/recovery on a running stack."""
import argparse
import json
import os
import subprocess
import time

import httpx


def _docker(action: str, container: str):
    subprocess.run(["docker", action, container], check=True, capture_output=True, text=True)


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node-container", default="trafficx-node-c")
    parser.add_argument("--node-url", default="http://localhost:7001")
    parser.add_argument("--peer-url", default="http://localhost:7002")
    parser.add_argument("--node-address", default="node-c:7003", help="Gossip address of the node being stopped")
    parser.add_argument("--kafka-container", default="trafficx-kafka")
    parser.add_argument("--timeout", type=float, default=90)
    parser.add_argument("--execute", action="store_true", help="Actually stop/start the selected Docker containers")
    args = parser.parse_args()
    if not args.execute:
        raise SystemExit("This benchmark stops and restarts containers. Re-run with --execute to authorize those actions.")

    client = httpx.Client(timeout=3)
    results = {}
    stopped = []
    try:
        start = time.perf_counter()
        _docker("stop", args.node_container)
        stopped.append(args.node_container)
        deadline = time.perf_counter() + args.timeout
        detected = None
        while time.perf_counter() < deadline:
            state = client.get(f"{args.peer_url}/state").json()
            peers = state.get("peers", {})
            if any(
                args.node_address == address and peer.get("status") == "unreachable"
                for address, peer in peers.items()
            ):
                detected = time.perf_counter() - start
                break
            time.sleep(1)
        if detected is None:
            raise TimeoutError("Peer did not report the stopped edge node as unreachable")
        results["peer_detection_time_s"] = round(detected, 3)

        _docker("stop", args.kafka_container)
        stopped.append(args.kafka_container)
        before = client.get(f"{args.node_url}/state").json()["kafka_buffer_size"]
        time.sleep(10)
        during = client.get(f"{args.node_url}/state").json()["kafka_buffer_size"]
        results["kafka_buffer_growth_10s"] = max(0, during - before)

        recovery_started = time.perf_counter()
        _docker("start", args.kafka_container)
        stopped.remove(args.kafka_container)
        deadline = time.perf_counter() + args.timeout
        while time.perf_counter() < deadline:
            state = client.get(f"{args.node_url}/state").json()
            if state.get("kafka_connected") and state.get("kafka_buffer_size", 1) == 0:
                results["kafka_recovery_time_s"] = round(time.perf_counter() - recovery_started, 3)
                break
            time.sleep(1)
        if "kafka_recovery_time_s" not in results:
            raise TimeoutError("Kafka did not reconnect and flush the local node buffer")
        results["kafka_dropped"] = state.get("kafka_dropped")

        _docker("start", args.node_container)
        stopped.remove(args.node_container)
        results["simulated"] = False
        results["status"] = "measured"
        os.makedirs("results", exist_ok=True)
        with open("results/bench_fault.json", "w", encoding="utf-8") as file:
            json.dump(results, file, indent=2)
        print(json.dumps(results, indent=2))
    finally:
        for container in reversed(stopped):
            subprocess.run(["docker", "start", container], check=False, capture_output=True, text=True)
        client.close()


if __name__ == "__main__":
    run()
