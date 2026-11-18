"""Small Kafka publisher lifecycle helper shared by optional source workers."""
import asyncio
import json
import logging
import os

try:
    from aiokafka import AIOKafkaProducer
except ImportError:
    AIOKafkaProducer = None

logger = logging.getLogger(__name__)


async def connect_producer():
    if AIOKafkaProducer is None:
        raise RuntimeError("aiokafka is required to publish source events")
    bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    delay = 1
    while True:
        producer = AIOKafkaProducer(bootstrap_servers=bootstrap)
        try:
            await producer.start()
            return producer
        except Exception as exc:
            logger.warning("Kafka unavailable (%s); retrying in %ss", type(exc).__name__, delay)
            try:
                await producer.stop()
            except Exception as stop_exc:
                logger.debug("Kafka producer cleanup failed: %s", stop_exc)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)


async def publish_json(producer, topic: str, key: str, value: dict):
    await producer.send_and_wait(
        topic,
        key=key.encode("utf-8"),
        value=json.dumps(value, default=str).encode("utf-8"),
    )
