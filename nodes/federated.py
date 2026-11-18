"""Experimental federated baseline that keeps raw observations on each node."""
import base64
import binascii
from collections import deque
from datetime import datetime, timezone
import io
import math
from typing import Iterable

import numpy as np

FEATURE_COUNT = 5
MAX_SAMPLE_COUNT = 20_000


def weights_to_base64(weights: Iterable[np.ndarray]) -> str:
    buf = io.BytesIO()
    np.savez(buf, *[np.asarray(w) for w in weights])
    return base64.b64encode(buf.getvalue()).decode("ascii")


def base64_to_weights(value: str) -> list[np.ndarray]:
    if not isinstance(value, str):
        raise ValueError("Federated weights must be base64 text")
    try:
        raw = base64.b64decode(value, validate=True)
        with np.load(io.BytesIO(raw), allow_pickle=False) as data:
            return [data[key] for key in data.files]
    except (binascii.Error, OSError, TypeError, ValueError) as exc:
        raise ValueError("Malformed federated weight payload") from exc


def fedavg(weight_sets: list[list[np.ndarray]], sample_counts: list[int]) -> list[np.ndarray]:
    if not weight_sets or len(weight_sets) != len(sample_counts):
        raise ValueError("No federated updates")
    if any(isinstance(count, bool) or not isinstance(count, int) or count <= 0 for count in sample_counts):
        raise ValueError("Federated sample counts must be positive integers")
    if any(len(weights) != len(weight_sets[0]) for weights in weight_sets):
        raise ValueError("Federated updates have different layer counts")
    for layer in range(len(weight_sets[0])):
        shape = weight_sets[0][layer].shape
        if any(weights[layer].shape != shape for weights in weight_sets):
            raise ValueError("Federated updates have incompatible layer shapes")
    total = sum(sample_counts)
    return [
        sum(weights[j] * sample_counts[i] for i, weights in enumerate(weight_sets)) / total
        for j in range(len(weight_sets[0]))
    ]


class FederatedLinearBaseline:
    """Locally train a tiny congestion regressor and FedAvg compatible weights."""

    def __init__(self, history_size: int = 256):
        self._examples = deque(maxlen=history_size)
        self.weights = np.zeros(FEATURE_COUNT, dtype=np.float64)
        self.sample_count = 0
        self.validation_mae = None

    @staticmethod
    def _features(summary: dict) -> np.ndarray:
        timestamp = summary.get("timestamp")
        try:
            dt = datetime.fromisoformat(timestamp) if isinstance(timestamp, str) else datetime.now(timezone.utc)
        except ValueError:
            dt = datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        hour = dt.hour + dt.minute / 60
        return np.asarray(
            [
                float(summary.get("vehicle_count", 0)) / 1200,
                float(summary.get("avg_speed", 0)) / 120,
                math.sin(2 * math.pi * hour / 24),
                math.cos(2 * math.pi * hour / 24),
                1.0,
            ],
            dtype=np.float64,
        )

    def observe(self, summary: dict):
        features = self._features(summary)
        target = float(summary.get("congestion_pct", 0)) / 100
        if not np.isfinite(features).all() or not math.isfinite(target):
            raise ValueError("Federated training example must contain finite values")
        self._examples.append((features, float(np.clip(target, 0, 1))))

        examples = list(self._examples)
        split = max(1, int(len(examples) * 0.8))
        train_x = np.asarray([item[0] for item in examples[:split]])
        train_y = np.asarray([item[1] for item in examples[:split]])
        self.sample_count = len(train_y)

        for _ in range(5):
            error = train_x @ self.weights - train_y
            self.weights -= 0.1 * (2 * train_x.T @ error / len(train_y))

        validation = examples[split:]
        self.validation_mae = (
            float(np.mean(np.abs(
                np.asarray([item[0] for item in validation]) @ self.weights
                - np.asarray([item[1] for item in validation])
            )))
            if validation
            else None
        )

    def predict(self, summary: dict) -> float:
        return float(np.clip(self._features(summary) @ self.weights, 0, 1) * 100)

    def export_update(self) -> dict:
        if self.sample_count < 1:
            return {}
        return {
            "version": 1,
            "weights": weights_to_base64([self.weights]),
            "sample_count": self.sample_count,
            "validation_mae": self.validation_mae,
            "source": "simulated-edge-observations",
        }

    def aggregate(self, update: dict):
        if not isinstance(update, dict) or update.get("version") != 1:
            raise ValueError("Unsupported federated update")
        count = update.get("sample_count")
        if isinstance(count, bool) or not isinstance(count, int) or not 1 <= count <= MAX_SAMPLE_COUNT:
            raise ValueError("Invalid federated sample count")
        weights = base64_to_weights(update.get("weights", ""))
        if len(weights) != 1 or weights[0].shape != self.weights.shape:
            raise ValueError("Invalid federated model weights")
        if not np.isfinite(weights[0]).all():
            raise ValueError("Federated weights must be finite")
        if self.sample_count:
            self.weights = fedavg(
                [[self.weights], [weights[0]]],
                [min(self.sample_count, MAX_SAMPLE_COUNT), count],
            )[0]
            self.sample_count = min(self.sample_count + count, MAX_SAMPLE_COUNT)
        else:
            self.weights = weights[0].copy()
            self.sample_count = count
