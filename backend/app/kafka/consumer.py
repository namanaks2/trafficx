"""
TrafficX Kafka Consumer
Processes traffic.raw events: enriches, stores to Cassandra,
runs ML predictions, detects incidents, broadcasts via WebSocket.
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Callable, Optional

logger = logging.getLogger(__name__)

try:
    from aiokafka import AIOKafkaConsumer
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False


class TrafficConsumer:
    def __init__(self):
        self._consumer = None
        self.connected = False
        self._running = False
        self._stats = {
            "traffic.raw":         {"messages": 0, "last_offset": -1, "last_ts": None},
            "traffic.processed":   {"messages": 0, "last_offset": -1, "last_ts": None},
            "traffic.predictions": {"messages": 0, "last_offset": -1, "last_ts": None},
            "traffic.incidents":   {"messages": 0, "last_offset": -1, "last_ts": None},
            "traffic.node_status": {"messages": 0, "last_offset": -1, "last_ts": None},
        }
        self._handlers: dict[str, list[Callable]] = {}

    def on(self, topic: str, handler: Callable):
        """Register a handler for a topic."""
        self._handlers.setdefault(topic, []).append(handler)

    async def start(self, bootstrap_servers: str, group_id: str, topics: list):
        if not KAFKA_AVAILABLE:
            logger.warning("Kafka consumer disabled.")
            return
        for attempt in range(15):
            try:
                self._consumer = AIOKafkaConsumer(
                    *topics,
                    bootstrap_servers=bootstrap_servers,
                    group_id=group_id,
                    auto_offset_reset="latest",
                    enable_auto_commit=True,
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                    session_timeout_ms=30000,
                    heartbeat_interval_ms=10000,
                )
                await self._consumer.start()
                self.connected = True
                self._running = True
                logger.info("Kafka consumer connected — topics: %s", topics)
                asyncio.create_task(self._consume_loop())
                return
            except Exception as e:
                logger.warning("Consumer connect attempt %d/15 failed: %s", attempt + 1, e)
                await asyncio.sleep(5)
        logger.error("Kafka consumer failed to start.")

    async def _consume_loop(self):
        try:
            async for msg in self._consumer:
                topic = msg.topic
                value = msg.value
                # Update stats
                s = self._stats.get(topic)
                if s:
                    s["messages"] += 1
                    s["last_offset"] = msg.offset
                    s["last_ts"] = datetime.utcnow().isoformat()
                # Dispatch handlers
                for handler in self._handlers.get(topic, []):
                    try:
                        await handler(value, msg)
                    except Exception as e:
                        logger.error("Handler error on %s: %s", topic, e)
        except Exception as e:
            logger.error("Consumer loop crashed: %s", e)
            self.connected = False
        finally:
            self._running = False

    def get_stats(self) -> dict:
        return {
            "connected": self.connected,
            "topics": self._stats,
        }

    async def stop(self):
        self._running = False
        if self._consumer:
            await self._consumer.stop()


consumer = TrafficConsumer()
