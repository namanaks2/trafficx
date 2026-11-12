"""
TrafficX P2P Node Simulation
Simulates independent monitoring nodes that share traffic observations.
In production, these would be separate processes/services communicating over HTTP/WebSocket.
"""
import uuid
import time
import random
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class NodeInfo:
    id: str
    name: str
    region: str
    location_name: str
    lat: float
    lng: float
    status: str = "online"
    peers: List[str] = field(default_factory=list)
    latency_ms: int = 15
    records_processed: int = 0
    uptime_pct: float = 99.5
    last_sync: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "region": self.region,
            "location_name": self.location_name,
            "lat": self.lat,
            "lng": self.lng,
            "status": self.status,
            "peers": self.peers,
            "latency": self.latency_ms,
            "records_processed": self.records_processed,
            "uptime": self.uptime_pct,
            "last_sync": self.last_sync or datetime.utcnow().isoformat(),
        }

    def generate_observation(self) -> dict:
        """Simulate a traffic observation from this node."""
        hour = datetime.utcnow().hour
        is_rush = (7 <= hour <= 9) or (17 <= hour <= 19)
        base_vehicles = random.randint(300, 900) if is_rush else random.randint(80, 400)
        base_speed = random.randint(10, 25) if is_rush else random.randint(30, 65)
        return {
            "vehicle_count": base_vehicles,
            "avg_speed_kmh": base_speed,
            "congestion_pct": max(5, min(99, 100 - (base_speed / 80 * 100) + random.randint(-5, 5))),
            "timestamp": datetime.utcnow().isoformat(),
            "sensor_type": "loop_detector",
        }


# Pre-configured node registry
NODE_REGISTRY = [
    NodeInfo("P2P-NODE-001", "Alpha Node", "US-East", "Downtown Junction", 40.7128, -74.0060, peers=["P2P-NODE-002","P2P-NODE-005","P2P-NODE-003"], latency_ms=12, records_processed=15847),
    NodeInfo("P2P-NODE-002", "Beta Node", "US-West", "Highway I-95 North", 40.7580, -73.9855, peers=["P2P-NODE-001","P2P-NODE-003","P2P-NODE-005"], latency_ms=28, records_processed=14230),
    NodeInfo("P2P-NODE-003", "Gamma Node", "EU-Central", "Bridge Crossing Alpha", 40.6892, -74.0445, peers=["P2P-NODE-001","P2P-NODE-002","P2P-NODE-004","P2P-NODE-005"], latency_ms=45, records_processed=12980),
    NodeInfo("P2P-NODE-004", "Delta Node", "Asia-East", "Airport Expressway", 40.6413, -73.7781, status="syncing", peers=["P2P-NODE-003","P2P-NODE-005"], latency_ms=85, records_processed=9847, uptime_pct=94.1),
    NodeInfo("P2P-NODE-005", "Epsilon Node", "US-South", "Westside Boulevard", 40.7549, -74.0025, peers=["P2P-NODE-001","P2P-NODE-002","P2P-NODE-003","P2P-NODE-004"], latency_ms=18, records_processed=13420),
    NodeInfo("P2P-NODE-006", "Zeta Node", "EU-West", "Financial District", 40.7074, -74.0113, status="offline", peers=[], latency_ms=0, records_processed=8120, uptime_pct=0.0),
]


class NodeNetwork:
    def __init__(self):
        self.nodes = {n.id: n for n in NODE_REGISTRY}

    def get_all(self) -> List[dict]:
        return [n.to_dict() for n in self.nodes.values()]

    def get_online(self) -> List[NodeInfo]:
        return [n for n in self.nodes.values() if n.status != "offline"]

    def get_node(self, node_id: str) -> Optional[NodeInfo]:
        return self.nodes.get(node_id)

    def broadcast_observation(self, source_node_id: str, observation: dict) -> List[str]:
        """Simulate broadcasting an observation to peers and returning confirmation node IDs."""
        node = self.nodes.get(source_node_id)
        if not node:
            return []
        confirmations = []
        for peer_id in node.peers:
            peer = self.nodes.get(peer_id)
            if peer and peer.status != "offline" and random.random() > 0.1:
                confirmations.append(peer_id)
                peer.records_processed += 1
        node.records_processed += 1
        node.last_sync = datetime.utcnow().isoformat()
        return confirmations

    def network_health(self) -> dict:
        total = len(self.nodes)
        online = len(self.get_online())
        return {
            "total_nodes": total,
            "online_nodes": online,
            "offline_nodes": total - online,
            "health_pct": round(online / total * 100, 1),
            "total_records": sum(n.records_processed for n in self.nodes.values()),
        }


# Singleton
node_network = NodeNetwork()
