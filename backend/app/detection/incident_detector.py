"""
Rule-based traffic anomaly detector.
Uses speed drop + vehicle density to flag potential incidents.
Never claims confirmed accidents from sensor data alone.
"""
import uuid, math
from datetime import datetime
from collections import deque, defaultdict
from typing import Optional

# Per-road rolling baseline (last 20 readings)
_baselines: dict[str, deque] = defaultdict(lambda: deque(maxlen=20))


def detect_incident(event: dict) -> Optional[dict]:
    road_id = event.get("road_id", "unknown")
    speed   = float(event.get("speed", 50))
    vc      = int(event.get("vehicle_count", 200))
    cong    = float(event.get("congestion_level", 40))
    zone    = event.get("zone", "unknown")
    lat     = float(event.get("latitude", 0.0))
    lng     = float(event.get("longitude", 0.0))

    baseline = _baselines[road_id]
    if len(baseline) >= 5:
        avg_speed = sum(b["speed"] for b in baseline) / len(baseline)
        avg_vc    = sum(b["vc"]    for b in baseline) / len(baseline)

        speed_drop    = (avg_speed - speed) / max(avg_speed, 1)
        density_spike = (vc - avg_vc) / max(avg_vc, 1)

        # Scoring: >30% speed drop AND >20% density increase
        if speed_drop > 0.30 and density_spike > 0.20:
            confidence = min(0.95, speed_drop * 0.6 + density_spike * 0.4)
            severity   = "critical" if speed_drop > 0.55 else "high" if speed_drop > 0.40 else "medium"
            incident = {
                "incident_id":    f"INC-{uuid.uuid4().hex[:8].upper()}",
                "road_id":        road_id,
                "zone":           zone,
                "incident_type":  "traffic_anomaly",
                "severity":       severity,
                "latitude":       lat,
                "longitude":      lng,
                "status":         "detected",
                "confidence":     round(confidence, 3),
                "description":    (
                    f"Potential incident: speed dropped {speed_drop*100:.0f}% "
                    f"(baseline {avg_speed:.0f}→{speed:.0f} km/h). "
                    f"Vehicle density increased {density_spike*100:.0f}%. "
                    f"Requires field verification."
                ),
                "timestamp":      datetime.utcnow().isoformat(),
                "speed_baseline": round(avg_speed, 1),
                "speed_current":  speed,
            }
            baseline.append({"speed": speed, "vc": vc})
            return incident

    baseline.append({"speed": speed, "vc": vc})
    return None
