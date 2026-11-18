# TrafficX Upgrade Progress

## Implemented

- Chronological per-road data splits and train-only scaling
- Three-head LSTM for 15/30/60-minute forecasts
- Rule-based and isolation-forest anomaly detection support
- 5-minute bucketed inference with warming-up fallback
- HTTP gossip, peer discovery, HMAC signatures, TTL, deduplication, and ledger verification
- Kafka reconnect buffer with ordered optional SQLite spill/replay
- Optional local linear-baseline training, gossip weight exchange, FedAvg, and rolling held-out MAE
- Camera/GPS/social source adapters
- UTC/schema validation and bounded event-ID deduplication for raw traffic
- CI workflow, focused unit/integration tests, and benchmarks that measure a running stack

## Metrics

Use `results/ml_metrics.json` and `results/anomaly_metrics.json` as the source of truth. Never infer metrics from source-code constants.

## Limitations and TODO

- Real Docker end-to-end benchmark metrics are unavailable until the stack is run on a host with Docker.
- Local demo-mode API timing is recorded in `results/bench_api.json`; it is not a full-stack performance result.
- Federated learning is an experimental linear baseline over local simulated edge observations, not the LSTM; it has no differential privacy or secure aggregation.
- Camera real mode requires a supplied Ultralytics model and video.
- Docker gossip result and fault-tolerance numbers must be collected on a running stack.
