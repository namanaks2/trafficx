"""Simulated social incident feed with optional transformers model."""
import random

KEYWORDS = ("accident", "collision", "road closed", "jam", "crash")


def classify_post(text: str) -> dict:
    try:
        from transformers import pipeline
        classifier = pipeline("text-classification", model="distilbert-base-uncased-finetuned-sst-2-english")
        result = classifier(text[:512])[0]
        label = "incident" if result["label"].upper() == "NEGATIVE" else "normal"
    except Exception:
        label = "incident" if any(word in text.lower() for word in KEYWORDS) else "normal"
    return {"text": text, "classification": label, "source": "social-simulated"}


def generate_posts(count: int = 5) -> list[dict]:
    templates = [
        "Heavy traffic jam near central bridge",
        "Road closed due to an accident",
        "Traffic is moving normally",
        "Possible collision reported on highway",
    ]
    return [classify_post(random.choice(templates)) for _ in range(count)]
