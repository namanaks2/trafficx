# TrafficX Upgrade Progress

## Implemented

- Chronological per-road data splits and train-only scaling
- Three-head LSTM for 15/30/60-minute forecasts
- Rule-based and isolation-forest anomaly detection support
- 5-minute bucketed inference with warming-up fallback
- HTTP gossip, peer discovery, HMAC signatures, TTL, deduplication, and ledger verification
- Kafka reconnect buffer and optional SQLite spill
- Optional federated-weight base64 and FedAvg helpers
- Camera/GPS/social source adapters
- CI workflow, unit/integration tests, and benchmark entry points

## Metrics

Use `results/ml_metrics.json` and `results/anomaly_metrics.json` as the source of truth. Never infer metrics from source-code constants.

## Limitations and TODO

- Real Docker end-to-end benchmarks require the full infrastructure running.
- Federated learning is behind `ENABLE_FEDERATED=true` and has weight exchange helpers, but no continuous production training loop is enabled by default.
- Camera real mode requires a supplied Ultralytics model and video.
- Docker gossip result and fault-tolerance numbers must be collected on a running stack.
