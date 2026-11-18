"""Runtime scoring for trained anomaly models."""
from __future__ import annotations

import os
import logging

import joblib
import numpy as np

logger = logging.getLogger(__name__)


class AnomalyDetector:
    def __init__(self):
        self.scaler = None
        self.model = None
        self.threshold = None
        model_path = os.path.join(os.path.dirname(__file__), "models", "anomaly_model.pkl")
        threshold_path = os.path.join(os.path.dirname(__file__), "models", "anomaly_threshold.txt")
        if os.path.exists(model_path):
            saved = joblib.load(model_path)
            if isinstance(saved, dict) and {"scaler", "model"} <= saved.keys():
                self.scaler = saved["scaler"]
                self.model = saved["model"]
            else:
                logger.warning("Ignoring legacy anomaly model without its training scaler")
        if os.path.exists(threshold_path):
            with open(threshold_path, encoding="utf-8") as file:
                self.threshold = float(file.read())

    def score(self, window) -> dict:
        values = np.asarray(window, dtype=np.float32)
        if self.model is None or self.scaler is None or self.threshold is None:
            return {"ml_score": None, "ml_anomaly": None, "model": "unavailable"}
        if values.ndim != 2 or values.shape[0] == 0:
            raise ValueError("Anomaly window must be a non-empty 2D array")
        flat = values.reshape(1, -1)
        scaled = self.scaler.transform(flat)
        score = float(-self.model.score_samples(scaled)[0])
        return {
            "ml_score": round(score, 6),
            "ml_anomaly": bool(score >= self.threshold),
            "model": "isolation_forest",
        }
