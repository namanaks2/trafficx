"""
Real-time LSTM inference wrapper.
Falls back to GBR rule-based predictor if LSTM model is not yet trained.
"""
import os, math, logging, json
import numpy as np
from datetime import datetime

logger = logging.getLogger(__name__)

MODEL_DIR   = os.path.join(os.path.dirname(__file__), "models")
KERAS_PATH  = os.path.join(MODEL_DIR, "lstm_model.keras")
SCALER_PATH = os.path.join(MODEL_DIR, "lstm_scaler.pkl")
METRICS_PATH= os.path.join(MODEL_DIR, "lstm_metrics.json")
SEQ_LEN     = 12
FEATURES    = ["vehicle_count", "speed", "hour_sin", "hour_cos", "is_rush", "is_weekend"]


class LSTMPredictor:
    def __init__(self):
        self._model  = None
        self._scaler = None
        self._metrics: dict = {}
        self.loaded  = False
        # Rolling window per road (road_id → list of feature vectors)
        self._windows: dict[str, list] = {}

    def load(self):
        if not (os.path.exists(KERAS_PATH) and os.path.exists(SCALER_PATH)):
            logger.warning("LSTM model not found — using rule-based fallback. "
                           "Run: python -m app.ml.lstm_train")
            return
        try:
            import tensorflow as tf
            import joblib
            self._model  = tf.keras.models.load_model(KERAS_PATH)
            self._scaler = joblib.load(SCALER_PATH)
            if os.path.exists(METRICS_PATH):
                with open(METRICS_PATH) as f:
                    self._metrics = json.load(f)
            self.loaded = True
            logger.info("LSTM model loaded from %s", KERAS_PATH)
        except Exception as e:
            logger.error("LSTM load failed: %s — using fallback.", e)

    def _extract_features(self, event: dict) -> list:
        hour    = datetime.utcnow().hour
        dow     = datetime.utcnow().weekday()
        is_rush = int((7 <= hour <= 9) or (17 <= hour <= 19))
        is_wknd = int(dow >= 5)
        return [
            float(event.get("vehicle_count", 300)),
            float(event.get("speed",          40)),
            math.sin(2 * math.pi * hour / 24),
            math.cos(2 * math.pi * hour / 24),
            float(is_rush),
            float(is_wknd),
        ]

    def _rule_based(self, event: dict) -> dict:
        """Deterministic fallback — clearly labelled as simulation."""
        spd  = float(event.get("speed", 40))
        hour = datetime.utcnow().hour
        rush = (7 <= hour <= 9) or (17 <= hour <= 19)
        base = max(5, min(99, 100 - spd / 80 * 100))
        def jit(x): return max(5, min(99, x + (3 if rush else -2)))
        return {
            "predicted_congestion_15": round(jit(base + 4),  1),
            "predicted_congestion_30": round(jit(base + 7),  1),
            "predicted_congestion_60": round(jit(base + 3),  1),
            "predicted_speed_15":      round(max(5, spd - 3), 1),
            "predicted_speed_30":      round(max(5, spd - 5), 1),
            "predicted_speed_60":      round(max(5, spd - 2), 1),
            "confidence_15": 72.0, "confidence_30": 65.0, "confidence_60": 58.0,
            "model_version": "rule-based-fallback",
            "is_simulated":  True,
            "timestamp":     datetime.utcnow().isoformat(),
        }

    def predict(self, event: dict) -> dict:
        if not self.loaded:
            return self._rule_based(event)
        try:
            road_id = event.get("road_id", "unknown")
            vec     = self._extract_features(event)
            win     = self._windows.setdefault(road_id, [])
            win.append(vec)
            if len(win) > SEQ_LEN:
                win.pop(0)
            # Pad with first element if window not full yet
            padded = ([win[0]] * (SEQ_LEN - len(win))) + win
            # Scale
            feat_scaler = self._scaler
            # Build dummy full row for scaler (features + target placeholder)
            full = [v + [0.0] for v in padded]  # append dummy target
            scaled_full = feat_scaler.transform(full)
            seq = scaled_full[:, :len(FEATURES)]
            seq_input = np.array([seq], dtype=np.float32)
            p15, p30, p60 = self._model.predict(seq_input, verbose=0)
            # Inverse-transform predictions (only target column)
            def inv(val):
                dummy = np.zeros((1, len(FEATURES) + 1))
                dummy[0, -1] = val
                return float(feat_scaler.inverse_transform(dummy)[0, -1])
            c15 = max(5, min(99, inv(float(p15[0, 0]))))
            c30 = max(5, min(99, inv(float(p30[0, 0]))))
            c60 = max(5, min(99, inv(float(p60[0, 0]))))
            spd = float(event.get("speed", 40))
            return {
                "predicted_congestion_15": round(c15, 1),
                "predicted_congestion_30": round(c30, 1),
                "predicted_congestion_60": round(c60, 1),
                "predicted_speed_15":  round(max(5, spd * (1 - c15 / 150)), 1),
                "predicted_speed_30":  round(max(5, spd * (1 - c30 / 150)), 1),
                "predicted_speed_60":  round(max(5, spd * (1 - c60 / 150)), 1),
                "confidence_15": 84.0, "confidence_30": 78.0, "confidence_60": 70.0,
                "model_version": "lstm-v1",
                "is_simulated":  False,
                "timestamp":     datetime.utcnow().isoformat(),
                "metrics":       self._metrics,
            }
        except Exception as e:
            logger.error("LSTM inference error: %s", e)
            return self._rule_based(event)

    def get_metrics(self) -> dict:
        return self._metrics


lstm_predictor = LSTMPredictor()
