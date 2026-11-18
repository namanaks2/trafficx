"""
Rule-based traffic anomaly detector.
Uses speed drop + vehicle density to flag potential incidents.
Never claims confirmed accidents from sensor data alone.
"""
import uuid
from datetime import datetime, timezone
from collections import deque, defaultdict
from typing import Optional
import numpy as np
import pandas as pd

from ..ml.anomaly_detector import AnomalyDetector
from ..ml.preprocessing import SEQ_LEN, STEP_MIN, time_features

_anomaly_detector = AnomalyDetector()

# Per-road rolling baseline (last 20 readings)
_baselines: dict[str, deque] = defaultdict(lambda: deque(maxlen=20))
_feature_windows: dict[str, deque] = defaultdict(lambda: deque(maxlen=SEQ_LEN))


def _update_feature_window(road_id: str, event: dict) -> Optional[np.ndarray]:
    timestamp = event.get("timestamp")
    try:
        bucket = pd.Timestamp(timestamp) if timestamp else pd.Timestamp.now(tz="UTC")
        if bucket.tzinfo is None:
            bucket = bucket.tz_localize("UTC")
        bucket = bucket.tz_convert("UTC").floor(f"{STEP_MIN}min")
    except (TypeError, ValueError):
        bucket = pd.Timestamp.now(tz="UTC").floor(f"{STEP_MIN}min")

    window = _feature_windows[road_id]
    if window and bucket < window[-1][0]:
        return None

    if window and bucket == window[-1][0]:
        window[-1] = (bucket, _feature_vector(event, bucket))
        return None
    else:
        if window:
            gap_steps = (bucket - window[-1][0]).total_seconds() / (STEP_MIN * 60)
            if gap_steps != 1:
                window.clear()
        window.append((bucket, _feature_vector(event, bucket)))

    if len(window) < SEQ_LEN:
        return None
    return np.asarray([values for _, values in window], dtype=np.float32)


def _feature_vector(event: dict, timestamp: pd.Timestamp) -> list[float]:
    time = time_features(timestamp)
    return [
        float(event.get("vehicle_count", 200)),
        float(event.get("speed", 50)),
        time["hour_sin"],
        time["hour_cos"],
        time["is_rush"],
        time["is_weekend"],
    ]


def detect_incident(event: dict) -> Optional[dict]:
    road_id = event.get("road_id", "unknown")
    speed   = float(event.get("speed", 50))
    vc      = int(event.get("vehicle_count", 200))
    cong    = float(event.get("congestion_level", 40))
    zone    = event.get("zone", "unknown")
    lat     = float(event.get("latitude", 0.0))
    lng     = float(event.get("longitude", 0.0))

    feature_window = _update_feature_window(road_id, event)
    ml_result = _anomaly_detector.score(feature_window) if feature_window is not None else {
        "ml_score": None, "ml_anomaly": None, "model": "warming_up"
    }

    baseline = _baselines[road_id]
    speed_drop = 0.0
    density_spike = 0.0
    rule_anomaly = False
    baseline_speed = sum(b["speed"] for b in baseline) / len(baseline) if baseline else speed
    if len(baseline) >= 5:
        avg_speed = baseline_speed
        avg_vc    = sum(b["vc"]    for b in baseline) / len(baseline)

        speed_drop    = (avg_speed - speed) / max(avg_speed, 1)
        density_spike = (vc - avg_vc) / max(avg_vc, 1)

        # Scoring: >30% speed drop AND >20% density increase
        rule_anomaly = speed_drop > 0.30 and density_spike > 0.20

    ml_anomaly = ml_result["ml_anomaly"] is True
    baseline.append({"speed": speed, "vc": vc})
    if rule_anomaly or ml_anomaly:
        confidence = min(0.95, speed_drop * 0.6 + density_spike * 0.4) if rule_anomaly else 0.6
        severity = "critical" if speed_drop > 0.55 else "high" if speed_drop > 0.40 or ml_anomaly else "medium"
        reasons = []
        if rule_anomaly:
            reasons.append(f"speed dropped {speed_drop*100:.0f}% and vehicle density rose {density_spike*100:.0f}%")
        if ml_anomaly:
            reasons.append(f"ML anomaly score {ml_result['ml_score']:.4f} exceeded its validation threshold")
        return {
            "incident_id":    f"INC-{uuid.uuid4().hex[:8].upper()}",
            "road_id":        road_id,
            "zone":           zone,
            "incident_type":  "traffic_anomaly",
            "severity":       severity,
            "latitude":       lat,
            "longitude":      lng,
            "status":         "detected",
            "confidence":     round(confidence, 3),
            "description":    f"Traffic anomaly: {'; '.join(reasons)}. Requires field verification.",
            "timestamp":      datetime.now(timezone.utc).isoformat(),
            "speed_baseline": round(baseline_speed, 1),
            "speed_current":  speed,
            "ml_score": ml_result["ml_score"],
            "ml_anomaly": ml_result["ml_anomaly"],
            "classification": "traffic anomaly",
        }
    return None
