"""Classify and publish simulated public traffic reports."""
import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone
from functools import lru_cache

try:
    from .kafka_utils import connect_producer, publish_json
except ImportError:
    from kafka_utils import connect_producer, publish_json

logger = logging.getLogger(__name__)
KEYWORDS = ("accident", "collision", "road closed", "jam", "crash")
POSTS = (
    "Heavy traffic jam near central bridge",
    "Road closed due to an accident",
    "Traffic is moving normally",
    "Possible collision reported on highway",
)


@lru_cache(maxsize=1)
def _sentiment_classifier():
    from transformers import pipeline
    return pipeline(
        "text-classification",
        model="distilbert-base-uncased-finetuned-sst-2-english",
    )


def classify_post(text: str) -> dict:
    keywords_match = any(word in text.lower() for word in KEYWORDS)
    try:
        # Sentiment alone is not evidence of an incident; require an explicit
        # traffic keyword and use the small model only as a corroborating cue.
        result = _sentiment_classifier()(text[:512])[0]
        model_available = True
        label = "incident" if keywords_match else "normal"
        confidence = float(result.get("score", 0.0))
    except (ImportError, OSError, RuntimeError) as exc:
        logger.info("NLP model unavailable (%s); using keyword classifier", type(exc).__name__)
        model_available = False
        label = "incident" if keywords_match else "normal"
        confidence = 1.0 if keywords_match else 0.0
    return {
        "text": text,
        "classification": label,
        "confidence": round(confidence, 4),
        "classifier": "distilbert" if model_available else "keyword-fallback",
        "source": "social-simulated",
    }


def generate_posts(count: int = 5) -> list[dict]:
    if count < 0:
        raise ValueError("count must be non-negative")
    return [classify_post(random.choice(POSTS)) for _ in range(count)]


async def main():
    producer = await connect_producer()
    try:
        while True:
            for post in generate_posts():
                event = {
                    **post,
                    "event_id": str(uuid.uuid4()),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "event_type": "traffic_anomaly" if post["classification"] == "incident" else "social_observation",
                }
                await publish_json(producer, "traffic.social", event["event_id"], event)
            await asyncio.sleep(30)
    finally:
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(main())
