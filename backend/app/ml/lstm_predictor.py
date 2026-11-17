"""
Real-time LSTM inference wrapper — lstm-v2.

Changes from v1:
  - Constants and time_features imported from preprocessing (no duplication)
  - Event timestamp parsed and converted to TRAFFIC_TZ, floored to 5-min bucket
  - One bucket per road per 5-min slot; replace if same bucket, clear on 3-step gap
  - No padding: rule-based fallback with warming_up=true until SEQ_LEN buckets ready
  - seed_windows_from_cassandra() prefills windows at startup
  - Scale via DataFrame with FEATURES+[TARGET] dummy column
  - Inference via model(x, training=False) inside asyncio.to_thread
  - 80% prediction intervals from validation RMSE in lstm_metrics.json
  - predicted_speed = max(5, 80*(1 - c/100))
  - model_version "lstm-v2", trained_on from metrics
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

MODEL_DIR    = os.path.join(os.path.dirname(__file__), "models")
KERAS_PATH   = os.path.join(MODEL_DIR, "lstm_model.keras")
SCALER_PATH  = os.path.join(MODEL_DIR, "lstm_scaler.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "lstm_metrics.json")

# Import shared constants and time_features from preprocessing
from .preprocessing import (
    FEATURES, TARGET, SEQ_LEN, STEP_MIN, HORIZONS, time_features, inv_target
)

_TRAFFIC_TZ_NAME = os.getenv("TRAFFIC_TZ", "Asia/Kolkata")
_DEFAULT_RMSE    = 10.0   # fallback if metrics file missing

try:
    from zoneinfo import ZoneInfo
    _TZ = ZoneInfo(_TRAFFIC_TZ_NAME)
except Exception:
    _TZ = None


def _to_local_ts(ts_str: Optional[str]) -> pd.Timestamp:
    """Parse event timestamp string, convert to TRAFFIC_TZ, floor to 5-min bucket."""
    try:
        if ts_str:
            dt = pd.Timestamp(ts_str)
            if dt.tzinfo is None:
                dt = dt.tz_localize("UTC")
        else:
            dt = pd.Timestamp.now(tz="UTC")
        # Convert to TRAFFIC_TZ
        try:
            dt = dt.tz_convert(_TRAFFIC_TZ_NAME)
        except Exception:
            pass
        # Floor to 5-min bucket
        floored = dt.floor(f"{STEP_MIN}min")
        return floored
    except Exception:
        return pd.Timestamp.now(tz="UTC").floor(f"{STEP_MIN}min")


class LSTMPredictor:
    def __init__(self):
        self._model  = None
        self._scaler = None
        self._metrics: dict = {}
        self.loaded  = False
        # road_id -> list of (bucket_ts, feature_vector)
        self._windows: Dict[str, List[Tuple[pd.Timestamp, List[float]]]] = {}

    # -------------------------------------------------------------------------
    def load(self):
        if not (os.path.exists(KERAS_PATH) and os.path.exists(SCALER_PATH)):
            logger.warning(
                "LSTM model not found — using rule-based fallback. "
                "Run: python -m app.ml.lstm_train"
            )
            return
        try:
            import tensorflow as tf  # noqa: F401
            import keras
            import joblib
            self._model  = keras.models.load_model(KERAS_PATH)
            self._scaler = joblib.load(SCALER_PATH)
            if os.path.exists(METRICS_PATH):
                with open(METRICS_PATH) as f:
                    self._metrics = json.load(f)
            self.loaded = True
            logger.info("LSTM v2 loaded from %s", KERAS_PATH)
        except Exception as e:
            logger.error("LSTM load failed: %s — using fallback.", e)

    # -------------------------------------------------------------------------
    def _build_feature_vector(self, event: dict, ts: pd.Timestamp) -> List[float]:
        tf = time_features(ts)
        return [
            float(event.get("vehicle_count", 300)),
            float(event.get("speed", 40)),
            tf["hour_sin"],
            tf["hour_cos"],
            tf["is_rush"],
            tf["is_weekend"],
        ]

    def _update_window(self, road_id: str, event: dict):
        """Add or replace the 5-min bucket for this event."""
        bucket = _to_local_ts(event.get("timestamp"))
        vec    = self._build_feature_vector(event, bucket)
        win    = self._windows.setdefault(road_id, [])

        # Clear if gap > 3 steps (15 min)
        if win:
            last_bucket = win[-1][0]
            gap_steps   = (bucket - last_bucket).total_seconds() / 60 / STEP_MIN
            if gap_steps > 3:
                win.clear()

        # Replace same bucket or append
        if win and win[-1][0] == bucket:
            win[-1] = (bucket, vec)
        else:
            win.append((bucket, vec))

        # Keep at most SEQ_LEN buckets
        if len(win) > SEQ_LEN:
            del win[0]

    def _get_sequence(self, road_id: str) -> Optional[np.ndarray]:
        """Return (1, SEQ_LEN, n_features) array if window is full, else None."""
        win = self._windows.get(road_id, [])
        if len(win) < SEQ_LEN:
            return None
        seq = np.array([v for _, v in win[-SEQ_LEN:]], dtype=np.float32)
        # Scale using scaler; dummy TARGET column = 0
        all_cols = FEATURES + [TARGET]
        df = pd.DataFrame(
            np.hstack([seq, np.zeros((SEQ_LEN, 1), dtype=np.float32)]),
            columns=all_cols,
        )
        scaled = self._scaler.transform(df)[: , :len(FEATURES)]
        return scaled[np.newaxis, :, :]  # (1, SEQ_LEN, 6)

    def _run_model_sync(self, x: np.ndarray):
        """Call model(x, training=False) — runs in asyncio.to_thread."""
        return self._model(x, training=False)

    def _prediction_intervals(self, c: float, horizon: str) -> Tuple[float, float]:
        try:
            rmse = self._metrics["horizons"][horizon]["lstm"]["rmse"]
        except (KeyError, TypeError):
            rmse = _DEFAULT_RMSE
        lo = max(5.0, c - 1.28 * rmse)
        hi = min(99.0, c + 1.28 * rmse)
        return round(lo, 2), round(hi, 2)

    # -------------------------------------------------------------------------
    def _rule_based(self, event: dict, warming_up: bool = False) -> dict:
        spd  = float(event.get("speed", 40))
        base = max(5.0, min(99.0, 100.0 - spd / 80.0 * 100.0))
        def jit(x, d): return max(5.0, min(99.0, x + d))
        return {
            "predicted_congestion_15": round(jit(base, 4), 1),
            "predicted_congestion_30": round(jit(base, 7), 1),
            "predicted_congestion_60": round(jit(base, 3), 1),
            "predicted_speed_15":      round(max(5.0, 80.0 * (1 - jit(base,4)/100.0)), 1),
            "predicted_speed_30":      round(max(5.0, 80.0 * (1 - jit(base,7)/100.0)), 1),
            "predicted_speed_60":      round(max(5.0, 80.0 * (1 - jit(base,3)/100.0)), 1),
            "interval_80_15": None, "interval_80_30": None, "interval_80_60": None,
            "model_version": "rule-based-fallback",
            "is_simulated":  True,
            "warming_up":    warming_up,
            "timestamp":     datetime.now(timezone.utc).isoformat(),
        }

    # -------------------------------------------------------------------------
    def predict(self, event: dict) -> dict:
        """Synchronous predict — calls async path via event loop if available."""
        if not self.loaded:
            return self._rule_based(event)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Caller is already async; they should call predict_async
                return self._predict_sync(event)
            else:
                return loop.run_until_complete(self.predict_async(event))
        except RuntimeError:
            return self._predict_sync(event)

    def _predict_sync(self, event: dict) -> dict:
        road_id = event.get("road_id", "unknown")
        self._update_window(road_id, event)
        seq = self._get_sequence(road_id)
        if seq is None:
            return self._rule_based(event, warming_up=True)
        try:
            outputs = self._run_model_sync(seq)
            return self._build_response(event, outputs)
        except Exception as e:
            logger.error("LSTM inference error: %s", e)
            return self._rule_based(event)

    async def predict_async(self, event: dict) -> dict:
        road_id = event.get("road_id", "unknown")
        self._update_window(road_id, event)
        seq = self._get_sequence(road_id)
        if seq is None:
            return self._rule_based(event, warming_up=True)
        try:
            outputs = await asyncio.to_thread(self._run_model_sync, seq)
            return self._build_response(event, outputs)
        except Exception as e:
            logger.error("LSTM async inference error: %s", e)
            return self._rule_based(event)

    def _build_response(self, event: dict, outputs) -> dict:
        """Convert raw model outputs to the response dict."""
        # outputs is a list of three (1,1) tensors
        p15_sc = float(outputs[0][0, 0])
        p30_sc = float(outputs[1][0, 0])
        p60_sc = float(outputs[2][0, 0])

        c15 = float(np.clip(inv_target(self._scaler, np.array([p15_sc]))[0], 5, 99))
        c30 = float(np.clip(inv_target(self._scaler, np.array([p30_sc]))[0], 5, 99))
        c60 = float(np.clip(inv_target(self._scaler, np.array([p60_sc]))[0], 5, 99))

        spd15 = round(max(5.0, 80.0 * (1 - c15 / 100.0)), 1)
        spd30 = round(max(5.0, 80.0 * (1 - c30 / 100.0)), 1)
        spd60 = round(max(5.0, 80.0 * (1 - c60 / 100.0)), 1)

        i15 = self._prediction_intervals(c15, "15")
        i30 = self._prediction_intervals(c30, "30")
        i60 = self._prediction_intervals(c60, "60")

        trained_on = self._metrics.get("dataset", "unknown")

        return {
            "predicted_congestion_15": round(c15, 1),
            "predicted_congestion_30": round(c30, 1),
            "predicted_congestion_60": round(c60, 1),
            "predicted_speed_15":  spd15,
            "predicted_speed_30":  spd30,
            "predicted_speed_60":  spd60,
            "interval_80_15": list(i15),
            "interval_80_30": list(i30),
            "interval_80_60": list(i60),
            "model_version": "lstm-v2",
            "trained_on":    trained_on,
            "is_simulated":  False,
            "warming_up":    False,
            "timestamp":     datetime.now(timezone.utc).isoformat(),
        }

    # -------------------------------------------------------------------------
    def seed_windows_from_cassandra(self):
        """
        Prefill rolling windows from Cassandra (last hour per road).
        Silently skips if Cassandra is unavailable.
        """
        try:
            from app.db.cassandra_client import get_session
            session = get_session()
            if session is None:
                return
            rows = session.execute(
                "SELECT road_id, timestamp, speed, vehicle_count "
                "FROM trafficx.traffic_by_road "
                "WHERE timestamp > toTimestamp(now()) - 1h ALLOW FILTERING"
            )
            for row in rows:
                event = {
                    "road_id":       row.road_id,
                    "timestamp":     row.timestamp.isoformat()
                                     if hasattr(row.timestamp, "isoformat") else str(row.timestamp),
                    "speed":         float(row.speed),
                    "vehicle_count": float(row.vehicle_count),
                }
                self._update_window(row.road_id, event)
            logger.info("Seeded windows from Cassandra for %d roads",
                        len(self._windows))
        except Exception as e:
            logger.debug("seed_windows_from_cassandra skipped: %s", e)

    def get_metrics(self) -> dict:
        return self._metrics


lstm_predictor = LSTMPredictor()
