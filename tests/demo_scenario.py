"""
TrafficX End-to-End Demo Scenario Script
Run: python tests/demo_scenario.py
Requires: docker compose up -d  (all services running)
"""
import asyncio, json, time, os
import httpx

BACKEND  = os.getenv("BACKEND_URL", "http://localhost:8000")
NODES    = [("NODE-A", 7001), ("NODE-B", 7002), ("NODE-C", 7003)]

PASS = "✓"
FAIL = "✗"
SKIP = "⚠"

async def step(label: str, fn):
    try:
        result = await fn() if asyncio.iscoroutinefunction(fn) else fn()
        print(f"  {PASS} {label}: {result}")
        return True
    except Exception as e:
        print(f"  {FAIL} {label}: {e}")
        return False


async def main():
    print("\n══ TrafficX End-to-End Demo ══\n")

    async with httpx.AsyncClient(timeout=5) as c:

        # 1. Backend health
        print("1. Backend + Kafka + Cassandra + LSTM")
        await step("Health endpoint", lambda: c.get(f"{BACKEND}/health").json())
        await step("API docs",        lambda: c.get(f"{BACKEND}/api/docs").status_code)
        await step("Kafka status",    lambda: c.get(f"{BACKEND}/api/kafka/status").json()["producer_connected"])
        await step("LSTM status",     lambda: c.get(f"{BACKEND}/api/health/").json()["lstm"]["loaded"])

        # 2. Traffic events from Cassandra
        print("\n2. Cassandra — stored traffic events")
        for road in ["R-001", "R-002"]:
            await step(f"Query {road}", lambda r=road: len(c.get(f"{BACKEND}/api/analytics/cassandra/traffic/{r}").json().get("data", [])))

        # 3. P2P Nodes
        print("\n3. P2P Edge Nodes (gossip over HTTP)")
        active = []
        for name, port in NODES:
            try:
                r = httpx.get(f"http://localhost:{port}/heartbeat", timeout=3)
                d = r.json()
                print(f"  {PASS} {name} (port {port}): status={d['status']} peers={d.get('peers_seen', [])}")
                active.append((name, port))
            except:
                print(f"  {SKIP} {name} (port {port}): not reachable")

        # 4. Gossip exchange
        print("\n4. P2P Gossip summaries")
        for name, port in active:
            try:
                s = httpx.get(f"http://localhost:{port}/summary", timeout=3).json()
                print(f"  {PASS} {name}: zone={s['zone']} speed={s['avg_speed']} cong={s['congestion_pct']}%")
            except Exception as e:
                print(f"  {FAIL} {name}: {e}")

        # 5. Simulate incident
        print("\n5. Incident simulation (via API)")
        try:
            r = c.post(f"{BACKEND}/api/incidents/", json={
                "type": "traffic_anomaly", "title": "Demo: Sudden speed drop",
                "location": "Test Road A", "severity": "high", "reported_by": "demo-script",
                "lat": 40.7128, "lng": -74.006,
            })
            d = r.json()
            print(f"  {PASS} Incident created: {d.get('id')}")
        except Exception as e:
            print(f"  {FAIL} Incident: {e}")

        # 6. Fault tolerance demo
        print("\n6. Node failure simulation")
        if active:
            name, port = active[0]
            try:
                r = httpx.post(f"http://localhost:{port}/simulate/failure", timeout=3)
                d = r.json()
                print(f"  {PASS} {name} set to '{d['status']}' — recovers in {d['recover_in_seconds']}s")
                # Check other nodes detected it via gossip
                await asyncio.sleep(NODES[0][1] and 2)
                if len(active) > 1:
                    _, port2 = active[1]
                    s2 = httpx.get(f"http://localhost:{port2}/state", timeout=3).json()
                    peers = s2.get("peers", {})
                    degraded = {k: v for k, v in peers.items() if v.get("status") == "unreachable"}
                    if degraded:
                        print(f"  {PASS} Peer {list(degraded.keys())} detected as unreachable from Node B")
                    else:
                        print(f"  {SKIP} Peer status not yet updated (gossip interval may not have fired)")
            except Exception as e:
                print(f"  {FAIL} Failure sim: {e}")

        # 7. LSTM prediction
        print("\n7. LSTM Predictions")
        try:
            r = c.get(f"{BACKEND}/api/traffic/predict/node-001")
            d = r.json()
            print(f"  {PASS} +15min: {d.get('predicted_15min')}%  +30min: {d.get('predicted_30min')}%  model: {d.get('model')}")
        except Exception as e:
            print(f"  {FAIL} Prediction: {e}")

    print("\n══ Demo complete ══\n")


if __name__ == "__main__":
    asyncio.run(main())
