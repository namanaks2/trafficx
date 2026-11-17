import json

with open("results/bench_fault.json", "w") as f:
    json.dump({"status": "requires_running_stack", "peer_detection_time_s": None,
               "kafka_buffer_growth": None, "recovery_time_s": None, "message_loss": None}, f)
