import hashlib
import json
import uuid
from datetime import datetime, timezone


class ChainedLedger:
    def __init__(self, node_id: str):
        self.node_id = node_id
        genesis = {"tx_id": "GENESIS", "node_id": "SYSTEM", "timestamp": datetime.now(timezone.utc).isoformat(),
                   "location": "TrafficX", "observation": {"type": "genesis"}, "prev_hash": "0" * 64}
        genesis["hash"] = self._hash(genesis)
        self.entries = [genesis]

    @property
    def length(self):
        return len(self.entries)

    def _hash(self, entry: dict) -> str:
        payload = {k: entry[k] for k in ("tx_id", "node_id", "timestamp", "location", "observation", "prev_hash")}
        return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()

    def add_entry(self, node_id: str, location: str, observation: dict) -> dict:
        entry = {
            "tx_id": f"TX-{uuid.uuid4().hex[:12]}",
            "node_id": node_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "location": location,
            "observation": observation,
            "prev_hash": self.entries[-1]["hash"],
        }
        entry["hash"] = self._hash(entry)
        self.entries.append(entry)
        return entry

    def verify(self) -> bool:
        for i in range(1, len(self.entries)):
            current = self.entries[i]
            if current["prev_hash"] != self.entries[i - 1]["hash"]:
                return False
            if current["hash"] != self._hash(current):
                return False
        return True

    def get_recent(self, limit: int = 20) -> list[dict]:
        return list(reversed(self.entries[-limit:]))
