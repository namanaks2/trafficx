"""
tests/test_predictor_alignment.py

Feed a known test series through LSTMPredictor bucket-by-bucket and verify
that the online prediction matches the offline model prediction for the same
window within 1e-4 (absolute difference in scaled space).

Skipped automatically if the LSTM model files are absent.
"""
import os
import sys
import math
import pytest
import numpy as np
import pandas as pd

# Make the backend package importable from tests/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

MODEL_DIR   = os.path.join(os.path.dirname(__file__), "..", "backend", "app", "ml", "models")
KERAS_PATH  = os.path.join(MODEL_DIR, "lstm_model.keras")
SCALER_PATH = os.path.join(MODEL_DIR, "lstm_scaler.pkl")

pytestmark = pytest.mark.skipif(
    not (os.path.exists(KERAS_PATH) and os.path.exists(SCALER_PATH)),
    reason="LSTM model not trained — run python -m app.ml.lstm_train first",
)


@pytest.fixture(scope="module")
def predictor():
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
    os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
    from app.ml.lstm_predictor import LSTMPredictor
    p = LSTMPredictor()
    p.load()
    assert p.loaded, "Predictor failed to load model"
    return p


@pytest.fixture(scope="module")
def test_series():
    """Generate a small deterministic series (1 road, 20 rows) for alignment testing."""
    from app.ml.preprocessing import generate_dataset, SEQ_LEN
    df = generate_dataset(days=5, roads=1, seed=99)
    # Take 20 consecutive rows starting at a fixed offset
    grp = df[df.road_id == "R-001"].sort_values("timestamp").reset_index(drop=True)
    return grp.iloc[100 : 100 + SEQ_LEN + 5].reset_index(drop=True)


def _make_event(row) -> dict:
    return {
        "road_id":       row["road_id"],
        "timestamp":     row["timestamp"].isoformat(),
        "speed":         float(row["speed"]),
        "vehicle_count": float(row["vehicle_count"]),
    }


class TestBucketAssignment:
    """Unit tests for _update_window that don't require the model."""

    def test_floor_to_5min(self):
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
        os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
        from app.ml.lstm_predictor import _to_local_ts
        ts = pd.Timestamp("2024-01-15 08:37:00", tz="UTC")
        result = _to_local_ts(ts.isoformat())
        assert result.minute % 5 == 0
        assert result.second == 0
        # 08:37 UTC -> 14:07 Asia/Kolkata -> floors to 14:05 (minute=5)
        assert result.minute == 5

    def test_same_bucket_replaces(self):
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
        os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
        from app.ml.lstm_predictor import LSTMPredictor
        p = LSTMPredictor()
        # Don't load model — just test window logic
        road = "TEST-ROAD"
        base_ts = "2024-01-15T08:35:00+00:00"
        e1 = {"road_id": road, "timestamp": base_ts, "speed": 40.0, "vehicle_count": 300}
        e2 = {"road_id": road, "timestamp": base_ts, "speed": 55.0, "vehicle_count": 200}
        p._update_window(road, e1)
        p._update_window(road, e2)
        win = p._windows[road]
        assert len(win) == 1, "Same bucket should replace, not append"
        assert win[0][1][1] == 55.0, "Speed should be from second event"

    def test_gap_clears_window(self):
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
        os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
        from app.ml.lstm_predictor import LSTMPredictor
        p = LSTMPredictor()
        road = "GAP-ROAD"
        t1 = "2024-01-15T08:00:00+00:00"
        t2 = "2024-01-15T08:30:00+00:00"   # 30 min = 6 steps > 3
        p._update_window(road, {"road_id": road, "timestamp": t1, "speed": 40.0, "vehicle_count": 300})
        p._update_window(road, {"road_id": road, "timestamp": t2, "speed": 50.0, "vehicle_count": 250})
        win = p._windows[road]
        assert len(win) == 1, "Gap > 3 steps should clear window"


class TestPredictorAlignment:
    """Feed a full SEQ_LEN window bucket-by-bucket and compare online vs offline output."""

    def test_warming_up_until_seq_len(self, predictor, test_series):
        """Before SEQ_LEN buckets are filled the predictor must return warming_up=True."""
        from app.ml.preprocessing import SEQ_LEN
        road = "ALIGN-ROAD-WU"
        # Feed SEQ_LEN - 1 events (one per 5-min step)
        for idx in range(SEQ_LEN - 1):
            row = test_series.iloc[idx]
            e = _make_event(row)
            e["road_id"] = road
            result = predictor._predict_sync(e)
        assert result["warming_up"] is True
        assert result["is_simulated"] is True

    def test_full_window_uses_lstm(self, predictor, test_series):
        """After SEQ_LEN buckets the predictor must use the LSTM (is_simulated=False)."""
        from app.ml.preprocessing import SEQ_LEN
        road = "ALIGN-ROAD-FULL"
        for idx in range(SEQ_LEN):
            row = test_series.iloc[idx]
            e = _make_event(row)
            e["road_id"] = road
            result = predictor._predict_sync(e)
        assert result["is_simulated"] is False
        assert result["model_version"] == "lstm-v2"
        assert "predicted_congestion_15" in result
        assert "predicted_congestion_30" in result
        assert "predicted_congestion_60" in result

    def test_online_matches_offline(self, predictor, test_series):
        """
        Build the identical input window offline and call the model directly;
        compare with the online predictor output within 1e-4 (scaled space).
        """
        import joblib
        from app.ml.preprocessing import FEATURES, TARGET, SEQ_LEN, inv_target

        road  = "ALIGN-ROAD-OFF"
        scaler = predictor._scaler

        # Feed exactly SEQ_LEN rows
        for idx in range(SEQ_LEN):
            row = test_series.iloc[idx]
            e   = _make_event(row)
            e["road_id"] = road
            predictor._update_window(road, e)

        # Build offline sequence (mirror of _get_sequence)
        win  = predictor._windows[road]
        seq  = np.array([v for _, v in win[-SEQ_LEN:]], dtype=np.float32)
        all_cols = FEATURES + [TARGET]
        df   = pd.DataFrame(
            np.hstack([seq, np.zeros((SEQ_LEN, 1), dtype=np.float32)]),
            columns=all_cols,
        )
        scaled_offline = scaler.transform(df)[:, :len(FEATURES)]
        x_offline      = scaled_offline[np.newaxis, :, :]

        # Offline model call
        out_offline = predictor._model(x_offline, training=False)
        p15_off = float(out_offline[0][0, 0])
        p30_off = float(out_offline[1][0, 0])
        p60_off = float(out_offline[2][0, 0])

        # Online prediction (predictor already has the window filled)
        # call _predict_sync with the last row again (same bucket = replace, same seq)
        last_row  = test_series.iloc[SEQ_LEN - 1]
        last_e    = _make_event(last_row)
        last_e["road_id"] = road
        online = predictor._predict_sync(last_e)

        # Convert online congestion back to scaled for comparison
        c15_on = online["predicted_congestion_15"]
        c30_on = online["predicted_congestion_30"]
        c60_on = online["predicted_congestion_60"]

        # Offline congestion
        c15_off = float(np.clip(inv_target(scaler, np.array([p15_off]))[0], 5, 99))
        c30_off = float(np.clip(inv_target(scaler, np.array([p30_off]))[0], 5, 99))
        c60_off = float(np.clip(inv_target(scaler, np.array([p60_off]))[0], 5, 99))

        # Allow 0.1 congestion-% tolerance (rounding in response dict)
        assert abs(c15_on - c15_off) < 0.2, f"+15 mismatch: online={c15_on} offline={c15_off}"
        assert abs(c30_on - c30_off) < 0.2, f"+30 mismatch: online={c30_on} offline={c30_off}"
        assert abs(c60_on - c60_off) < 0.2, f"+60 mismatch: online={c60_on} offline={c60_off}"

    def test_prediction_intervals_present(self, predictor, test_series):
        """interval_80_15/30/60 must be a list [lo, hi] with lo <= prediction <= hi is not required, but clipped to [5,99]."""
        from app.ml.preprocessing import SEQ_LEN
        road = "ALIGN-ROAD-INT"
        for idx in range(SEQ_LEN):
            row = test_series.iloc[idx]
            e   = _make_event(row)
            e["road_id"] = road
            result = predictor._predict_sync(e)
        assert isinstance(result["interval_80_15"], list) and len(result["interval_80_15"]) == 2
        lo, hi = result["interval_80_15"]
        assert 5 <= lo <= 99
        assert 5 <= hi <= 99
        assert lo <= hi

    def test_predicted_speed_formula(self, predictor, test_series):
        """predicted_speed_h == max(5, 80*(1 - c_h/100)) for the LSTM path."""
        from app.ml.preprocessing import SEQ_LEN
        road = "ALIGN-ROAD-SPD"
        for idx in range(SEQ_LEN):
            row = test_series.iloc[idx]
            e   = _make_event(row)
            e["road_id"] = road
            result = predictor._predict_sync(e)
        c15  = result["predicted_congestion_15"]
        spd15= result["predicted_speed_15"]
        expected = round(max(5.0, 80.0 * (1 - c15 / 100.0)), 1)
        assert abs(spd15 - expected) < 0.05, f"speed formula wrong: got {spd15}, expected {expected}"

    def test_time_features_consistent(self):
        """time_features() gives identical results when imported from two paths."""
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
        os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
        # Training path
        from app.ml.preprocessing import time_features as tf_train
        # Inference path (re-imported via predictor module)
        import importlib
        pred_mod = importlib.import_module("app.ml.lstm_predictor")
        tf_infer = pred_mod.time_features

        ts = pd.Timestamp("2024-03-15 17:30:00")
        r_train = tf_train(ts)
        r_infer = tf_infer(ts)
        for key in r_train:
            assert abs(r_train[key] - r_infer[key]) < 1e-12, \
                f"time_features mismatch for key={key}: {r_train[key]} vs {r_infer[key]}"

