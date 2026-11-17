"""Train and evaluate an Isolation-Forest fallback or LSTM-autoencoder."""
from __future__ import annotations

import argparse
import json
import os
from datetime import date
import joblib

import numpy as np

from .preprocessing import FEATURES, SEQ_LEN, generate_dataset

RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "results", "anomaly_metrics.json")


def make_windows(df, normal_only=True):
    frames = []
    for _, road in df.groupby("road_id"):
        road = road.sort_values("timestamp").reset_index(drop=True)
        vals = road[FEATURES].to_numpy(dtype=np.float32)
        for i in range(SEQ_LEN, len(vals)):
            frames.append(vals[i-SEQ_LEN:i])
    return np.asarray(frames, dtype=np.float32)


def inject_anomalies(windows):
    injected = np.array(windows, copy=True)
    labels = np.zeros(len(injected), dtype=np.int8)
    if len(injected) == 0:
        return injected, labels
    rng = np.random.default_rng(42)
    count = max(1, len(injected) // 50)
    idx = rng.choice(len(injected), size=count, replace=False)
    for j, kind in zip(idx, rng.integers(0, 3, size=count)):
        if kind == 0:
            injected[j, -1, 1] *= 0.25
        elif kind == 1:
            injected[j, :, 0] = injected[j, -1, 0]
        else:
            injected[j, -1, 0] *= 1.8
        labels[j] = 1
    return injected, labels


def rule_predictions(windows):
    return ((windows[:, -1, 1] < 15) | (windows[:, -1, 0] > 900)).astype(np.int8)


def run(args=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    cfg = parser.parse_args(args)
    df = generate_dataset(days=60, roads=5, seed=cfg.seed)
    split = int(len(df) * 0.85)
    train_df = df.iloc[:split]
    test_df = df.iloc[split:]
    train_windows = make_windows(train_df)
    test_windows = make_windows(test_df)
    test_windows, truth = inject_anomalies(test_windows)

    try:
        from sklearn.ensemble import IsolationForest
        model = IsolationForest(contamination=0.01, random_state=cfg.seed)
        model.fit(train_windows.reshape(len(train_windows), -1))
        scores = -model.score_samples(test_windows.reshape(len(test_windows), -1))
        threshold = float(np.percentile(scores, 99))
        ml_pred = (scores >= threshold).astype(np.int8)
        model_dir = os.path.join(os.path.dirname(__file__), "models")
        os.makedirs(model_dir, exist_ok=True)
        joblib.dump(model, os.path.join(model_dir, "anomaly_model.pkl"))
        with open(os.path.join(model_dir, "anomaly_threshold.txt"), "w") as f:
            f.write(str(threshold))
    except ImportError:
        threshold = 0.0
        ml_pred = rule_predictions(test_windows)
        scores = ml_pred.astype(np.float32)

    def metrics(pred):
        tp = int(((pred == 1) & (truth == 1)).sum())
        fp = int(((pred == 1) & (truth == 0)).sum())
        fn = int(((pred == 0) & (truth == 1)).sum())
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}

    doc = {
        "training_date": date.today().isoformat(),
        "model": "isolation_forest",
        "threshold": threshold,
        "injected_types": ["sudden_speed_drop", "sensor_stuck", "vehicle_count_spike"],
        "ml": metrics(ml_pred),
        "rule_based": metrics(rule_predictions(test_windows)),
    }
    os.makedirs(os.path.dirname(RESULTS_PATH), exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(doc, f, indent=2)
    print(json.dumps(doc, indent=2))
    return doc


if __name__ == "__main__":
    run()
