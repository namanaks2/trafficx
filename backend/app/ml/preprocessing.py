"""
Traffic data preprocessing for LSTM.
Generates synthetic dataset if no CSV exists; normalises features; builds sequences.
"""
import os, math, random
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import MinMaxScaler

FEATURES = ["vehicle_count", "speed", "hour_sin", "hour_cos", "is_rush", "is_weekend"]
TARGET   = "congestion_level"
SEQ_LEN  = 12   # 12 × 5-min intervals = 1 h lookback


def generate_dataset(n: int = 15000) -> pd.DataFrame:
    rows = []
    for _ in range(n):
        hour  = random.randint(0, 23)
        dow   = random.randint(0, 6)
        rush  = int((7 <= hour <= 9) or (17 <= hour <= 19))
        night = int(hour < 5 or hour > 22)
        wkend = int(dow >= 5)
        base_v = 600 if rush else 120 if night else 380
        if wkend: base_v = int(base_v * 0.65)
        vc  = max(10, min(1200, int(base_v + random.gauss(0, 90))))
        base_s = 22 if rush else 68 if night else 42
        if wkend: base_s = min(85, int(base_s * 1.25))
        spd = max(5, min(120, base_s + random.gauss(0, 7)))
        cong = max(5, min(99, 100 - (spd / 80 * 100) + random.gauss(0, 4)))
        rows.append({
            "road_id":          f"R-{random.randint(1,5):03d}",
            "timestamp":        pd.Timestamp.now() - pd.Timedelta(minutes=random.randint(0, 43200)),
            "vehicle_count":    vc,
            "speed":            spd,
            "hour":             hour,
            "hour_sin":         math.sin(2 * math.pi * hour / 24),
            "hour_cos":         math.cos(2 * math.pi * hour / 24),
            "is_rush":          rush,
            "is_weekend":       wkend,
            "congestion_level": cong,
        })
    df = pd.DataFrame(rows).sort_values("timestamp").reset_index(drop=True)
    return df


def build_sequences(df: pd.DataFrame, scaler_path: str):
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(df[FEATURES + [TARGET]])
    joblib.dump(scaler, scaler_path)

    X, y15, y30, y60 = [], [], [], []
    step = 1  # each row ≈ 5 min
    h15, h30, h60 = 3, 6, 12  # 15/30/60 min ahead

    target_idx = len(FEATURES)   # last column
    for i in range(SEQ_LEN, len(scaled) - h60):
        X.append(scaled[i - SEQ_LEN:i, :len(FEATURES)])
        y15.append(scaled[i + h15, target_idx])
        y30.append(scaled[i + h30, target_idx])
        y60.append(scaled[i + h60, target_idx])

    X   = np.array(X,   dtype=np.float32)
    y15 = np.array(y15, dtype=np.float32)
    y30 = np.array(y30, dtype=np.float32)
    y60 = np.array(y60, dtype=np.float32)
    return X, y15, y30, y60, scaler
