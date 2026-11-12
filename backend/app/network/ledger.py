"""
TrafficX Distributed Ledger
Implements a tamper-evident SHA-256 chained ledger for traffic observations.
This is a simulation of a distributed ledger — not a full blockchain.
"""
import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import List, Optional
from datetime import datetime


@dataclass
class LedgerEntry:
    tx_id: str
    node_id: str
    timestamp: str
    location: str
    observation: dict
    prev_hash: str
    hash: str = ""
    verified: bool = False
    peer_confirmations: int = 0

    def compute_hash(self) -> str:
        payload = json.dumps({
            "tx_id": self.tx_id,
            "node_id": self.node_id,
            "timestamp": self.timestamp,
            "location": self.location,
            "observation": self.observation,
            "prev_hash": self.prev_hash,
        }, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()[:24]

    def to_dict(self) -> dict:
        return {
            "tx_id": self.tx_id,
            "node_id": self.node_id,
            "timestamp": self.timestamp,
            "location": self.location,
            "observation": json.dumps(self.observation),
            "prev_hash": self.prev_hash,
            "hash": self.hash,
            "verified": self.verified,
            "peers": self.peer_confirmations,
        }


class DistributedLedger:
    """
    Tamper-evident chained record store.
    Each entry contains the hash of the previous entry, forming a chain.
    Modifying any entry would invalidate all subsequent hashes.
    """

    def __init__(self):
        self.entries: List[LedgerEntry] = []
        self._create_genesis()

    def _create_genesis(self):
        genesis = LedgerEntry(
            tx_id="TX-GENESIS-0000",
            node_id="SYSTEM",
            timestamp=datetime.utcnow().isoformat(),
            location="TrafficX Network",
            observation={"type": "genesis", "message": "TrafficX ledger initialized"},
            prev_hash="0" * 24,
        )
        genesis.hash = genesis.compute_hash()
        genesis.verified = True
        genesis.peer_confirmations = 5
        self.entries.append(genesis)

    @property
    def latest_hash(self) -> str:
        return self.entries[-1].hash if self.entries else "0" * 24

    def add_entry(self, node_id: str, location: str, observation: dict) -> LedgerEntry:
        entry = LedgerEntry(
            tx_id=f"TX-{uuid.uuid4().hex[:8].upper()}",
            node_id=node_id,
            timestamp=datetime.utcnow().isoformat(),
            location=location,
            observation=observation,
            prev_hash=self.latest_hash,
        )
        entry.hash = entry.compute_hash()
        self.entries.append(entry)
        return entry

    def verify_chain(self) -> bool:
        """Verify chain integrity — each entry must reference the correct previous hash."""
        for i in range(1, len(self.entries)):
            current = self.entries[i]
            previous = self.entries[i - 1]
            if current.prev_hash != previous.hash:
                return False
            if current.hash != current.compute_hash():
                return False
        return True

    def get_recent(self, limit: int = 20) -> List[dict]:
        return [e.to_dict() for e in reversed(self.entries[-limit:])]

    def confirm_entry(self, tx_id: str, peer_count: int = 1):
        for entry in self.entries:
            if entry.tx_id == tx_id:
                entry.peer_confirmations += peer_count
                if entry.peer_confirmations >= 3:
                    entry.verified = True
                break


# Singleton ledger instance
ledger = DistributedLedger()
