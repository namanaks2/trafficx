-- TrafficX Cassandra Schema
-- Keyspace designed for time-series traffic data with appropriate partition keys

CREATE KEYSPACE IF NOT EXISTS trafficx
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
  AND durable_writes = true;

USE trafficx;

-- ─── Traffic Events by Road ───────────────────────────────────────────────────
-- Partition key: road_id — all data for a road in one partition
-- Clustering: timestamp DESC — most recent first
CREATE TABLE IF NOT EXISTS traffic_by_road (
    road_id         TEXT,
    timestamp       TIMESTAMP,
    zone            TEXT,
    speed           FLOAT,
    vehicle_count   INT,
    congestion_level FLOAT,
    latitude        DOUBLE,
    longitude       DOUBLE,
    incident_score  FLOAT,
    event_type      TEXT,
    source_node     TEXT,
    kafka_offset    BIGINT,
    PRIMARY KEY ((road_id), timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC)
  AND default_time_to_live = 604800;  -- 7 days TTL

-- ─── Predictions by Road ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions_by_road (
    road_id               TEXT,
    prediction_timestamp  TIMESTAMP,
    forecast_horizon_min  INT,
    predicted_speed       FLOAT,
    predicted_congestion  FLOAT,
    confidence            FLOAT,
    model_version         TEXT,
    is_simulated          BOOLEAN,
    PRIMARY KEY ((road_id), prediction_timestamp, forecast_horizon_min)
) WITH CLUSTERING ORDER BY (prediction_timestamp DESC, forecast_horizon_min ASC)
  AND default_time_to_live = 86400;  -- 24h TTL

-- ─── Incidents by Zone ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents_by_zone (
    zone            TEXT,
    timestamp       TIMESTAMP,
    incident_id     TEXT,
    road_id         TEXT,
    incident_type   TEXT,
    severity        TEXT,
    latitude        DOUBLE,
    longitude       DOUBLE,
    status          TEXT,
    confidence      FLOAT,
    description     TEXT,
    PRIMARY KEY ((zone), timestamp, incident_id)
) WITH CLUSTERING ORDER BY (timestamp DESC, incident_id ASC)
  AND default_time_to_live = 2592000;  -- 30 days TTL

-- ─── Node Health ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_health (
    node_id          TEXT,
    timestamp        TIMESTAMP,
    status           TEXT,
    last_heartbeat   TIMESTAMP,
    processing_load  FLOAT,
    peers_connected  INT,
    records_processed BIGINT,
    zone             TEXT,
    PRIMARY KEY ((node_id), timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC)
  AND default_time_to_live = 86400;

-- ─── Kafka Offset Tracking (idempotent writes) ───────────────────────────────
CREATE TABLE IF NOT EXISTS kafka_offsets (
    topic       TEXT,
    partition   INT,
    offset      BIGINT,
    updated_at  TIMESTAMP,
    PRIMARY KEY ((topic), partition)
);

-- ─── Secondary indexes for common queries ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_traffic_zone ON traffic_by_road (zone);
CREATE INDEX IF NOT EXISTS idx_incident_status ON incidents_by_zone (status);
