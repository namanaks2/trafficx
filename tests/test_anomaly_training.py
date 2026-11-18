import numpy as np
from collections import defaultdict, deque

from backend.app.detection import incident_detector
from backend.app.ml.anomaly_train import chronological_windows, inject_anomalies
from backend.app.ml.preprocessing import SEQ_LEN, generate_dataset


def test_anomaly_windows_are_split_per_road_before_windowing():
    days = 14
    roads = 2
    per_road = days * 24 * 12
    splits = chronological_windows(generate_dataset(days=days, roads=roads, seed=7))

    expected = []
    for section_size in (
        int(per_road * 0.70),
        int(per_road * 0.15),
        per_road - int(per_road * 0.70) - int(per_road * 0.15),
    ):
        expected.append(roads * max(0, section_size - SEQ_LEN + 1))
    assert [len(splits[name][0]) for name in ("train", "val", "test")] == expected


def test_injected_anomaly_labels_match_changes_and_preserve_input():
    windows = np.ones((100, SEQ_LEN, 6), dtype=np.float32)
    original = windows.copy()

    injected, labels = inject_anomalies(windows, seed=11)

    assert int(labels.sum()) == 2
    assert np.array_equal(windows, original)
    assert np.count_nonzero(np.any(injected != original, axis=(1, 2))) == int(labels.sum())


def test_runtime_anomaly_scoring_uses_new_five_minute_buckets(monkeypatch):
    seen = []
    monkeypatch.setattr(incident_detector, "_feature_windows", defaultdict(lambda: deque(maxlen=SEQ_LEN)))
    monkeypatch.setattr(
        incident_detector._anomaly_detector,
        "score",
        lambda window: seen.append(window.copy()) or {
            "ml_score": 0.1,
            "ml_anomaly": False,
            "model": "test",
        },
    )

    for step in range(SEQ_LEN):
        incident_detector.detect_incident({
            "road_id": "bucketed-test",
            "timestamp": f"2025-01-01T00:{step * 5:02d}:00+00:00",
            "speed": 50,
            "vehicle_count": 200,
        })

    incident_detector.detect_incident({
        "road_id": "bucketed-test",
        "timestamp": "2025-01-01T00:55:30+00:00",
        "speed": 51,
        "vehicle_count": 201,
    })

    assert len(seen) == 1
    assert seen[0].shape == (SEQ_LEN, 6)
