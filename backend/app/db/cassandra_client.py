"""
TrafficX Cassandra Client
Provides async-compatible, prepared-statement-based access to Cassandra.
"""
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

try:
    from cassandra.cluster import Cluster, NoHostAvailable
    from cassandra.auth import PlainTextAuthProvider
    from cassandra.policies import DCAwareRoundRobinPolicy, RetryPolicy
    from cassandra.query import PreparedStatement, BatchStatement
    CASSANDRA_AVAILABLE = True
except ImportError:
    CASSANDRA_AVAILABLE = False
    logger.warning("cassandra-driver not installed — Cassandra disabled.")


class CassandraClient:
    """Thread-safe Cassandra client with prepared statements and retry logic."""

    def __init__(self):
        self._cluster = None
        self._session = None
        self._prepared: Dict[str, Any] = {}
        self.connected = False

    def connect(self, contact_points: List[str], port: int, keyspace: str,
                username: Optional[str] = None, password: Optional[str] = None):
        if not CASSANDRA_AVAILABLE:
            logger.warning("Cassandra not available — running without persistence.")
            return
        try:
            auth = PlainTextAuthProvider(username, password) if username else None
            self._cluster = Cluster(
                contact_points=contact_points,
                port=port,
                auth_provider=auth,
                load_balancing_policy=DCAwareRoundRobinPolicy(),
                default_retry_policy=RetryPolicy(),
                connect_timeout=10,
                control_connection_timeout=10,
            )
            self._session = self._cluster.connect(keyspace)
            self.connected = True
            self._prepare_statements()
            logger.info("Cassandra connected to %s / keyspace=%s", contact_points, keyspace)
        except Exception as exc:
            logger.error("Cassandra connection failed: %s — running without persistence.", exc)
            self.connected = False

    def _prepare_statements(self):
        s = self._session
        self._prepared = {
            "insert_traffic": s.prepare("""
                INSERT INTO traffic_by_road
                (road_id, timestamp, zone, speed, vehicle_count, congestion_level,
                 latitude, longitude, incident_score, event_type, source_node, kafka_offset)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                IF NOT EXISTS
            """),
            "insert_prediction": s.prepare("""
                INSERT INTO predictions_by_road
                (road_id, prediction_timestamp, forecast_horizon_min,
                 predicted_speed, predicted_congestion, confidence, model_version, is_simulated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """),
            "insert_incident": s.prepare("""
                INSERT INTO incidents_by_zone
                (zone, timestamp, incident_id, road_id, incident_type, severity,
                 latitude, longitude, status, confidence, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """),
            "insert_node_health": s.prepare("""
                INSERT INTO node_health
                (node_id, timestamp, status, last_heartbeat, processing_load,
                 peers_connected, records_processed, zone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """),
            "query_traffic_recent": s.prepare("""
                SELECT * FROM traffic_by_road WHERE road_id = ? LIMIT ?
            """),
            "query_incidents_by_zone": s.prepare("""
                SELECT * FROM incidents_by_zone WHERE zone = ? LIMIT ?
            """),
            "query_predictions": s.prepare("""
                SELECT * FROM predictions_by_road WHERE road_id = ? LIMIT ?
            """),
            "upsert_offset": s.prepare("""
                INSERT INTO kafka_offsets (topic, partition, offset, updated_at)
                VALUES (?, ?, ?, ?)
            """),
        }

    # ── Write helpers ─────────────────────────────────────────────────────────

    def insert_traffic_event(self, event: dict):
        if not self.connected:
            return
        try:
            ts = datetime.fromisoformat(event.get("timestamp", datetime.utcnow().isoformat()))
            self._session.execute(self._prepared["insert_traffic"], (
                event.get("road_id", "unknown"),
                ts,
                event.get("zone", "unknown"),
                float(event.get("speed", 0)),
                int(event.get("vehicle_count", 0)),
                float(event.get("congestion_level", 0)),
                float(event.get("latitude", 0.0)),
                float(event.get("longitude", 0.0)),
                float(event.get("incident_score", 0.0)),
                event.get("event_type", "observation"),
                event.get("source_node", "unknown"),
                int(event.get("kafka_offset", -1)),
            ))
        except Exception as e:
            logger.error("Cassandra insert_traffic_event error: %s", e)

    def insert_prediction(self, pred: dict):
        if not self.connected:
            return
        try:
            ts = datetime.fromisoformat(pred.get("timestamp", datetime.utcnow().isoformat()))
            for horizon, (spd, cong, conf) in [
                (15, (pred.get("predicted_speed_15", 0), pred.get("predicted_congestion_15", 0), pred.get("confidence_15", 0))),
                (30, (pred.get("predicted_speed_30", 0), pred.get("predicted_congestion_30", 0), pred.get("confidence_30", 0))),
                (60, (pred.get("predicted_speed_60", 0), pred.get("predicted_congestion_60", 0), pred.get("confidence_60", 0))),
            ]:
                self._session.execute(self._prepared["insert_prediction"], (
                    pred.get("road_id", "unknown"),
                    ts,
                    horizon,
                    float(spd),
                    float(cong),
                    float(conf),
                    pred.get("model_version", "unknown"),
                    bool(pred.get("is_simulated", True)),
                ))
        except Exception as e:
            logger.error("Cassandra insert_prediction error: %s", e)

    def insert_incident(self, incident: dict):
        if not self.connected:
            return
        try:
            ts = datetime.fromisoformat(incident.get("timestamp", datetime.utcnow().isoformat()))
            self._session.execute(self._prepared["insert_incident"], (
                incident.get("zone", "unknown"),
                ts,
                incident.get("incident_id", "unknown"),
                incident.get("road_id", "unknown"),
                incident.get("incident_type", "anomaly"),
                incident.get("severity", "low"),
                float(incident.get("latitude", 0.0)),
                float(incident.get("longitude", 0.0)),
                incident.get("status", "detected"),
                float(incident.get("confidence", 0.5)),
                incident.get("description", ""),
            ))
        except Exception as e:
            logger.error("Cassandra insert_incident error: %s", e)

    def insert_node_health(self, health: dict):
        if not self.connected:
            return
        try:
            ts = datetime.utcnow()
            hb = datetime.fromisoformat(health.get("last_heartbeat", ts.isoformat()))
            self._session.execute(self._prepared["insert_node_health"], (
                health.get("node_id"),
                ts,
                health.get("status", "unknown"),
                hb,
                float(health.get("processing_load", 0.0)),
                int(health.get("peers_connected", 0)),
                int(health.get("records_processed", 0)),
                health.get("zone", "unknown"),
            ))
        except Exception as e:
            logger.error("Cassandra insert_node_health error: %s", e)

    # ── Read helpers ─────────────────────────────────────────────────────────

    def get_recent_traffic(self, road_id: str, limit: int = 50) -> List[dict]:
        if not self.connected:
            return []
        try:
            rows = self._session.execute(self._prepared["query_traffic_recent"], (road_id, limit))
            return [dict(r._asdict()) for r in rows]
        except Exception as e:
            logger.error("Cassandra query error: %s", e)
            return []

    def get_incidents_by_zone(self, zone: str, limit: int = 20) -> List[dict]:
        if not self.connected:
            return []
        try:
            rows = self._session.execute(self._prepared["query_incidents_by_zone"], (zone, limit))
            return [dict(r._asdict()) for r in rows]
        except Exception as e:
            logger.error("Cassandra incident query error: %s", e)
            return []

    def get_predictions(self, road_id: str, limit: int = 10) -> List[dict]:
        if not self.connected:
            return []
        try:
            rows = self._session.execute(self._prepared["query_predictions"], (road_id, limit))
            return [dict(r._asdict()) for r in rows]
        except Exception as e:
            logger.error("Cassandra prediction query error: %s", e)
            return []

    def status(self) -> dict:
        if not CASSANDRA_AVAILABLE:
            return {"connected": False, "reason": "driver not installed"}
        if not self.connected:
            return {"connected": False, "reason": "connection failed"}
        try:
            hosts = [{"address": str(h.address), "status": h.is_up} for h in self._cluster.metadata.all_hosts()]
            return {"connected": True, "hosts": hosts, "keyspace": self._session.keyspace}
        except Exception as e:
            return {"connected": False, "reason": str(e)}

    def shutdown(self):
        if self._cluster:
            self._cluster.shutdown()


# Singleton
cassandra = CassandraClient()
