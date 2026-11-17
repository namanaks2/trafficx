"""
TrafficX Kafka Producer
Publishes traffic events to appropriate Kafka topics.
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from aiokafka import AIOKafkaProducer
    from aiokafka.errors import KafkaConnectionError
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    logger.warning("aiokafka not installed — Kafka disabled.")


class TrafficProducer:
    def __init__(self):
        self._producer: Optional[object] = None
        self.connected = False
        self._bootstrap_servers = "localhost:9092"

    async def start(self, bootstrap_servers: str):
        if not KAFKA_AVAILABLE:
            logger.warning("Kafka producer disabled — aiokafka not available.")
            return
        self._bootstrap_servers = bootstrap_servers
        for attempt in range(10):
            try:
                self._producer = AIOKafkaProducer(
                    bootstrap_servers=bootstrap_servers,
                    value_serializer=lambda v: json.dumps(v, default=str).encode(),
                    key_serializer=lambda k: k.encode() if k else None,
                    acks="all",
                    enable_idempotence=True,
                    compression_type="gzip",
                    max_batch_size=65536,
                )
                await self._producer.start()
                self.connected = True
                logger.info("Kafka producer connected to %s", bootstrap_servers)
                return
            except Exception as e:
                logger.warning("Kafka connect attempt %d/10 failed: %s", attempt + 1, e)
                await asyncio.sleep(5)
        logger.error("Kafka producer failed to connect after 10 attempts.")

    async def publish(self, topic: str, value: dict, key: Optional[str] = None):
        if not self.connected or not self._producer:
            return
        try:
            value["_published_at"] = datetime.utcnow().isoformat()
            await self._producer.send_and_wait(topic, value=value, key=key)
        except Exception as e:
            logger.error("Kafka publish to %s failed: %s", topic, e)
            self.connected = False
            asyncio.create_task(self._reconnect())

    async def _reconnect(self):
        logger.info("Attempting Kafka reconnect...")
        await asyncio.sleep(10)
        await self.start(self._bootstrap_servers)

    async def stop(self):
        if self._producer:
            await self._producer.stop()
            self.connected = False

    async def publish_traffic_raw(self, event: dict):
        """Publish raw sensor reading — key by road_id for partition locality."""
        road_id = event.get("road_id", "unknown")
        await self.publish("traffic.raw", event, key=road_id)

    async def publish_processed(self, event: dict):
        await self.publish("traffic.processed", event, key=event.get("road_id"))

    async def publish_prediction(self, pred: dict):
        await self.publish("traffic.predictions", pred, key=pred.get("road_id"))

    async def publish_incident(self, incident: dict):
        await self.publish("traffic.incidents", incident, key=incident.get("zone"))

    async def publish_node_status(self, status: dict):
        await self.publish("traffic.node_status", status, key=status.get("node_id"))


producer = TrafficProducer()
