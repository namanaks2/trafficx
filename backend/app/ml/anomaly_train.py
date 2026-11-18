"""Train and evaluate a normal-only Isolation Forest anomaly detector."""
from __future__ import annotations

import argparse
import json
import os
from datetime import date

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from .preprocessing import FEATURES, SEQ_LEN, generate_dataset

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "results", "anomaly_metrics.json")


def build_windows(df):
    """Build per-road windows and mark those containing generated incidents."""
    windows, incident_flags = [], []
    for _, road in df.groupby("road_id", sort=True):
        road = road.sort_values("timestamp").reset_index(drop=True)
        values = road[FEATURES].to_numpy(dtype=np.float32)
        incidents = road["is_incident"].to_numpy(dtype=np.int8)
        for end in range(SEQ_LEN, len(road) + 1):
            windows.append(values[end - SEQ_LEN:end])
            incident_flags.append(bool(incidents[end - SEQ_LEN:end].any()))
    return np.asarray(windows), np.asarray(incident_flags, dtype=bool)


def chronological_windows(df):
    """Split each road chronologically before constructing windows."""
    parts = {name: [] for name in ("train", "val", "test")}
    for _, road in df.groupby("road_id", sort=True):
        road = road.sort_values("timestamp").reset_index(drop=True)
        n = len(road)
        train_end = int(n * 0.70)
        val_end = train_end + int(n * 0.15)
        for name, section in (
            ("train", road.iloc[:train_end]),
            ("val", road.iloc[train_end:val_end]),
            ("test", road.iloc[val_end:]),
        ):
            windows, incident = build_windows(section)
            if len(windows):
                parts[name].append((windows, incident))
    return {
        name: (
            np.concatenate([item[0] for item in values]),
            np.concatenate([item[1] for item in values]),
        )
        for name, values in parts.items()
    }


def inject_anomalies(windows, seed=42):
    """Inject balanced, labelled anomalies into separate copies of test windows."""
    injected = np.array(windows, copy=True)
    labels = np.zeros(len(injected), dtype=np.int8)
    eligible = np.arange(len(injected))
    count = min(len(eligible), max(1, len(eligible) // 50)) if len(eligible) else 0
    if not count:
        return injected, labels

    rng = np.random.default_rng(seed)
    selected = rng.choice(eligible, size=count, replace=False)
    kinds = np.arange(count) % 3
    rng.shuffle(kinds)
    for index, kind in zip(selected, kinds):
        if kind == 0:
            speed = injected[index, -1, 1]
            injected[index, -1, 1] = min(speed * 0.2, speed - 1.0)
        elif kind == 1:
            count_values = injected[index, :, 0]
            stuck_value = max(float(count_values.max()) * 1.1, float(count_values.max()) + 1.0)
            injected[index, :, 0] = stuck_value
        else:
            injected[index, -1, 0] = max(injected[index, -1, 0] * 2.5, 1200.0)
        labels[index] = 1
    return injected, labels


def rule_predictions(windows):
    """Simple baseline using instantaneous speed and vehicle-count thresholds."""
    return ((windows[:, -1, 1] < 15) | (windows[:, -1, 0] > 900)).astype(np.int8)


def _metrics(predictions, labels):
    tp = int(((predictions == 1) & (labels == 1)).sum())
    fp = int(((predictions == 1) & (labels == 0)).sum())
    fn = int(((predictions == 0) & (labels == 1)).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}


def run(args=None):
    parser = argparse.ArgumentParser(description="Train/evaluate TrafficX anomaly detector")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--days", type=int, default=60)
    cfg = parser.parse_args(args)

    splits = chronological_windows(generate_dataset(days=cfg.days, roads=5, seed=cfg.seed))
    train_windows, train_incidents = splits["train"]
    val_windows, val_incidents = splits["val"]
    test_windows, test_incidents = splits["test"]
    normal_train = train_windows[~train_incidents]
    normal_val = val_windows[~val_incidents]
    if len(normal_train) < 2 or not len(normal_val) or not len(test_windows):
        raise ValueError("Not enough normal train/validation and test windows to train the detector")

    # Bound fit cost for larger datasets while keeping sampling reproducible.
    rng = np.random.default_rng(cfg.seed)
    if len(normal_train) > 20000:
        normal_train = normal_train[rng.choice(len(normal_train), 20000, replace=False)]

    scaler = StandardScaler()
    train_flat = normal_train.reshape(len(normal_train), -1)
    scaler.fit(train_flat)
    train_scaled = scaler.transform(train_flat)
    val_flat = scaler.transform(normal_val.reshape(len(normal_val), -1))
    model = IsolationForest(contamination="auto", random_state=cfg.seed, n_estimators=200, n_jobs=-1)
    model.fit(train_scaled)
    val_scores = -model.score_samples(val_flat)
    threshold = float(np.percentile(val_scores, 99))

    # Keep naturally generated incident windows and inject anomalies into separate
    # windows; the two labels are unioned so the test truth stays explicit.
    injected, injected_labels = inject_anomalies(test_windows, seed=cfg.seed)
    truth = np.logical_or(test_incidents, injected_labels.astype(bool)).astype(np.int8)
    test_scores = -model.score_samples(scaler.transform(injected.reshape(len(injected), -1)))
    ml_predictions = (test_scores >= threshold).astype(np.int8)

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump({"scaler": scaler, "model": model}, os.path.join(MODEL_DIR, "anomaly_model.pkl"))
    with open(os.path.join(MODEL_DIR, "anomaly_threshold.txt"), "w", encoding="utf-8") as file:
        file.write(str(threshold))

    metrics = {
        "training_date": date.today().isoformat(),
        "dataset": "synthetic",
        "seed": cfg.seed,
        "evaluation": "chronological test windows with natural incidents and labelled injected anomalies",
        "normal_train_windows": int(len(normal_train)),
        "normal_validation_windows": int(len(normal_val)),
        "test_windows": int(len(test_windows)),
        "injected_anomalies": int(injected_labels.sum()),
        "threshold": threshold,
        "injected_types": ["sudden_speed_drop", "sensor_stuck", "vehicle_count_spike"],
        "ml": _metrics(ml_predictions, truth),
        "rule_based": _metrics(rule_predictions(injected), truth),
    }
    os.makedirs(os.path.dirname(RESULTS_PATH), exist_ok=True)
    with open(RESULTS_PATH, "w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)
    print(json.dumps(metrics, indent=2))
    return metrics


if __name__ == "__main__":
    run()
