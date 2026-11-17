"""Optional lightweight federated averaging scaffold."""
import base64
import io
import os
from typing import Iterable

import numpy as np


def weights_to_base64(weights: Iterable[np.ndarray]) -> str:
    buf = io.BytesIO()
    np.savez(buf, *[np.asarray(w) for w in weights])
    return base64.b64encode(buf.getvalue()).decode("ascii")


def base64_to_weights(value: str) -> list[np.ndarray]:
    raw = base64.b64decode(value)
    with np.load(io.BytesIO(raw), allow_pickle=False) as data:
        return [data[key] for key in data.files]


def fedavg(weight_sets: list[list[np.ndarray]], sample_counts: list[int]) -> list[np.ndarray]:
    total = sum(sample_counts)
    if not weight_sets or total == 0:
        raise ValueError("No federated updates")
    return [
        sum(weights[j] * sample_counts[i] for i, weights in enumerate(weight_sets)) / total
        for j in range(len(weight_sets[0]))
    ]
