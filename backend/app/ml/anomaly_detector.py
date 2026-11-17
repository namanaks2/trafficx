"""Runtime wrapper for anomaly scoring."""
import os
import joblib


class AnomalyDetector:
    def __init__(self):
        self.model = None
        self.threshold = None
        path = os.path.join(os.path.dirname(__file__), "models", "anomaly_model.pkl")
        threshold_path = os.path.join(os.path.dirname(__file__), "models", "anomaly_threshold.txt")
        if os.path.exists(path):
            self.model = joblib.load(path)
        if os.path.exists(threshold_path):
            self.threshold = float(open(threshold_path).read())

    def score(self, window) -> dict:
        if self.model is None:
            return {"ml_score": 0.0, "ml_anomaly": False, "model": "unavailable"}
        flat = window.reshape(1, -1)
        score = float(-self.model.score_samples(flat)[0])
        anomaly = self.threshold is not None and score >= self.threshold
        return {"ml_score": round(score, 6), "ml_anomaly": bool(anomaly), "model": "isolation_forest"}
