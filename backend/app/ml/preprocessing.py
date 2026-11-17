"""
Traffic data preprocessing for LSTM.

Generates a temporally coherent synthetic dataset:
  - One continuous 5-minute series per road (AR(1) load with daily peaks + incidents)
  - Per-road chronological 70/15/15 split
  - MinMaxScaler fit on TRAIN ONLY (no leakage)
  - Sequences with correctly-aligned targets: target = scaled[i-1+h, target_col]
  - time_features() shared by training AND inference
  - is_incident column carried through for evaluation ONLY (never a model feature)
"""

from __future__ import annotations

import math
import os
from typing import Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

# ---------------------------------------------------------------------------
# Constants (single source of truth; imported by lstm_train and lstm_predictor)
# ---------------------------------------------------------------------------
FEATURES = ["vehicle_count", "speed", "hour_sin", "hour_cos", "is_rush", "is_weekend"]
TARGET   = "congestion_level"
SEQ_LEN  = 12          # 12 x 5-min steps = 60-min lookback
STEP_MIN = 5           # minutes between rows
HORIZONS = {"15": 3, "30": 6, "60": 12}   # horizon name -> number of steps ahead

_TARGET_COL = len(FEATURES)   # column index of TARGET in the scaled array


# ---------------------------------------------------------------------------
# Feature engineering (SHARED by training and inference)
# ---------------------------------------------------------------------------
def time_features(ts: pd.Timestamp) -> dict:
    """
    Compute time-derived features from a pandas Timestamp (minutes are used).
    Returns: hour_sin, hour_cos, is_rush (0/1), is_weekend (0/1).
    """
    frac_hour = ts.hour + ts.minute / 60.0
    hour_sin  = math.sin(2 * math.pi * frac_hour / 24)
    hour_cos  = math.cos(2 * math.pi * frac_hour / 24)
    is_rush   = int((7.0 <= frac_hour < 9.5) or (16.0 <= frac_hour < 19.0))
    is_weekend = int(ts.dayofweek >= 5)
    return {
        "hour_sin":   hour_sin,
        "hour_cos":   hour_cos,
        "is_rush":    float(is_rush),
        "is_weekend": float(is_weekend),
    }


# ---------------------------------------------------------------------------
# Synthetic dataset generator
# ---------------------------------------------------------------------------
def _demand_profile(ts: pd.Timestamp) -> float:
    """Daily demand [0,1]: morning ~8:30 and evening ~18:00 peaks; weekends 60%."""
    frac_hour = ts.hour + ts.minute / 60.0
    morning = math.exp(-0.5 * ((frac_hour - 8.5) / 1.2) ** 2)
    evening = math.exp(-0.5 * ((frac_hour - 18.0) / 1.5) ** 2)
    base = 0.15 + 0.70 * max(morning, evening)
    if ts.dayofweek >= 5:
        base *= 0.6
    return float(np.clip(base, 0.0, 1.0))


def generate_dataset(days: int = 60, roads: int = 5, seed: int = 42) -> pd.DataFrame:
    """
    Continuous 5-minute traffic time series per road.
    Carries 'is_incident' flag for evaluation only — NOT in FEATURES.
    """
    rng   = np.random.default_rng(seed)
    rows  = []
    start = pd.Timestamp("2024-01-01 00:00:00")
    times = pd.date_range(start, periods=days * 24 * (60 // STEP_MIN), freq=f"{STEP_MIN}min")

    for road_idx in range(roads):
        road_id    = f"R-{road_idx + 1:03d}"
        n          = len(times)

        # Incident schedule
        n_incidents = max(1, int(round(days / 3)))
        inc_starts  = rng.integers(0, n, size=n_incidents)
        inc_lens    = rng.integers(30 // STEP_MIN, 120 // STEP_MIN + 1, size=n_incidents)
        inc_loads   = rng.uniform(0.3, 0.6, size=n_incidents)
        incident_extra = np.zeros(n, dtype=np.float32)
        is_incident    = np.zeros(n, dtype=np.int8)
        for s, l, v in zip(inc_starts, inc_lens, inc_loads):
            incident_extra[s : s + l] = v
            is_incident[s : s + l]    = 1

        # AR(1) noise
        phi    = 0.9
        noise  = np.zeros(n, dtype=np.float32)
        noise[0] = float(rng.normal(0, 0.05))
        for t in range(1, n):
            noise[t] = phi * noise[t - 1] + float(rng.normal(0, 0.05 * math.sqrt(1 - phi**2)))

        for i, ts in enumerate(times):
            demand = _demand_profile(ts)
            load   = float(np.clip(demand + noise[i] + incident_extra[i], 0.05, 0.99))
            speed  = float(np.clip(80.0 * (1.0 - load), 5.0, 80.0))
            vc     = int(round(load * 1200))
            cong   = float(np.clip(100.0 - speed / 80.0 * 100.0, 5.0, 99.0))
            tf     = time_features(ts)
            rows.append({
                "road_id":          road_id,
                "timestamp":        ts,
                "vehicle_count":    float(vc),
                "speed":            speed,
                "hour_sin":         tf["hour_sin"],
                "hour_cos":         tf["hour_cos"],
                "is_rush":          tf["is_rush"],
                "is_weekend":       tf["is_weekend"],
                TARGET:             cong,
                "is_incident":      int(is_incident[i]),   # eval-only flag
            })

    df = pd.DataFrame(rows).sort_values(["road_id", "timestamp"]).reset_index(drop=True)
    return df


# ---------------------------------------------------------------------------
# Sequence builder (leakage-free)
# ---------------------------------------------------------------------------
def build_splits(df: pd.DataFrame, scaler_path: str):
    """
    Per-road chronological 70/15/15 split with no data leakage.

    Returns dict with:
      X_{train,val,test}, y{15,30,60}_{train,val,test},
      cur_{train,val,test}  (real congestion at last input step, for persistence)
      ts_{train,val,test}   (pandas Timestamp at last input step, for TOD baseline)
      is_incident_{train,val,test}  (eval flag: 1 if any step in window is incident)
      scaler
    """
    all_cols = FEATURES + [TARGET]
    h15, h30, h60 = HORIZONS["15"], HORIZONS["30"], HORIZONS["60"]
    max_h = h60

    train_frames: list = []
    road_splits: Dict[str, Tuple] = {}

    for road_id, grp in df.groupby("road_id", sort=True):
        grp = grp.sort_values("timestamp").reset_index(drop=True)
        vals       = grp[all_cols].values.astype(np.float32)
        timestamps = grp["timestamp"].values          # numpy datetime64
        incidents  = grp["is_incident"].values.astype(np.int8)
        n       = len(vals)
        n_train = int(math.floor(n * 0.70))
        n_val   = int(math.floor(n * 0.15))
        train_frames.append(vals[:n_train])
        road_splits[road_id] = (vals, timestamps, incidents, n_train, n_val)

    # Fit scaler on TRAIN ONLY
    train_all = np.vstack(train_frames)
    scaler    = MinMaxScaler()
    scaler.fit(train_all)
    joblib.dump(scaler, scaler_path)

    buckets = {split: {"X": [], "y15": [], "y30": [], "y60": [],
                       "cur": [], "ts": [], "is_incident": []}
               for split in ("train", "val", "test")}

    for road_id, (vals, timestamps, incidents, n_train, n_val) in road_splits.items():
        scaled = scaler.transform(vals)

        for split_name, raw_sl, sc_sl, ts_sl, inc_sl in [
            ("train", vals[:n_train],
                      scaled[:n_train],
                      timestamps[:n_train],
                      incidents[:n_train]),
            ("val",   vals[n_train:n_train+n_val],
                      scaled[n_train:n_train+n_val],
                      timestamps[n_train:n_train+n_val],
                      incidents[n_train:n_train+n_val]),
            ("test",  vals[n_train+n_val:],
                      scaled[n_train+n_val:],
                      timestamps[n_train+n_val:],
                      incidents[n_train+n_val:]),
        ]:
            sc  = sc_sl
            raw = raw_sl
            m   = len(sc)
            if m < SEQ_LEN + max_h:
                continue
            for i in range(SEQ_LEN, m - max_h + 1):
                x_seq = sc[i - SEQ_LEN : i, :len(FEATURES)]
                t15   = sc[i - 1 + h15, _TARGET_COL]
                t30   = sc[i - 1 + h30, _TARGET_COL]
                t60   = sc[i - 1 + h60, _TARGET_COL]
                cur_raw = raw[i - 1, _TARGET_COL]
                # timestamp at last input step (for TOD lookup)
                step_ts = pd.Timestamp(ts_sl[i - 1])
                # incident flag: 1 if the target step (i-1+h60) falls in an incident
                inc_flag = int(inc_sl[min(i - 1 + h60, m - 1)])

                buckets[split_name]["X"].append(x_seq)
                buckets[split_name]["y15"].append(t15)
                buckets[split_name]["y30"].append(t30)
                buckets[split_name]["y60"].append(t60)
                buckets[split_name]["cur"].append(cur_raw)
                buckets[split_name]["ts"].append(step_ts)
                buckets[split_name]["is_incident"].append(inc_flag)

    result = {"scaler": scaler}
    for split in ("train", "val", "test"):
        b = buckets[split]
        result[f"X_{split}"]           = np.array(b["X"],           dtype=np.float32)
        result[f"y15_{split}"]         = np.array(b["y15"],         dtype=np.float32)
        result[f"y30_{split}"]         = np.array(b["y30"],         dtype=np.float32)
        result[f"y60_{split}"]         = np.array(b["y60"],         dtype=np.float32)
        result[f"cur_{split}"]         = np.array(b["cur"],         dtype=np.float32)
        result[f"ts_{split}"]          = b["ts"]          # list of pd.Timestamp
        result[f"is_incident_{split}"] = np.array(b["is_incident"], dtype=np.int8)
    return result


# ---------------------------------------------------------------------------
# Inverse-transform target column only
# ---------------------------------------------------------------------------
def inv_target(scaler: MinMaxScaler, y: np.ndarray) -> np.ndarray:
    """Inverse-transform scaled TARGET values back to congestion-% units."""
    y = np.asarray(y, dtype=np.float64).ravel()
    n_features = len(FEATURES) + 1
    dummy = np.zeros((len(y), n_features), dtype=np.float64)
    dummy[:, _TARGET_COL] = y
    return scaler.inverse_transform(dummy)[:, _TARGET_COL].astype(np.float32)


# ---------------------------------------------------------------------------
# METR-LA loader
# ---------------------------------------------------------------------------
def load_metr_la(path: str) -> pd.DataFrame:
    """Load METR-LA (CSV or HDF5) and convert to TrafficX schema."""
    import sys
    if not os.path.exists(path):
        print(
            f"METR-LA file not found at: {path}\n"
            "Download it from:\n"
            "  https://zenodo.org/records/5146264  (metr-la.h5)\n"
            "or:\n"
            "  https://github.com/liyaguang/DCRNN  (data/metr-la.h5)\n"
            "Then re-run with --dataset metr-la --path <path-to-file>"
        )
        sys.exit(1)

    ext = os.path.splitext(path)[1].lower()
    if ext in (".h5", ".hdf5"):
        raw = pd.read_hdf(path)
        raw = raw.stack().reset_index()
        raw.columns = ["timestamp", "sensor_id", "speed"]
    elif ext == ".csv":
        raw = pd.read_csv(path, index_col=0, parse_dates=True)
        raw = raw.stack().reset_index()
        raw.columns = ["timestamp", "sensor_id", "speed"]
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

    raw["timestamp"] = pd.to_datetime(raw["timestamp"])
    raw["road_id"]   = raw["sensor_id"].astype(str)
    raw["speed"]     = pd.to_numeric(raw["speed"], errors="coerce").fillna(0).clip(lower=5, upper=120)

    rows = []
    for _, row in raw.iterrows():
        ts   = row["timestamp"]
        spd  = float(row["speed"])
        load = float(np.clip(1.0 - spd / 80.0, 0.05, 0.99))
        vc   = int(round(load * 1200))
        cong = float(np.clip(100.0 - spd / 80.0 * 100.0, 5.0, 99.0))
        tf   = time_features(ts)
        rows.append({
            "road_id":       row["road_id"],
            "timestamp":     ts,
            "vehicle_count": float(vc),
            "speed":         spd,
            "hour_sin":      tf["hour_sin"],
            "hour_cos":      tf["hour_cos"],
            "is_rush":       tf["is_rush"],
            "is_weekend":    tf["is_weekend"],
            TARGET:          cong,
            "is_incident":   0,
        })

    df = pd.DataFrame(rows).sort_values(["road_id", "timestamp"]).reset_index(drop=True)
    return df
