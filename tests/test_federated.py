import numpy as np
import pytest

from nodes.federated import FederatedLinearBaseline, fedavg


def _summary(step, congestion):
    return {
        "timestamp": f"2025-01-01T00:{step:02d}:00+00:00",
        "vehicle_count": 100 + step * 10,
        "avg_speed": 70 - step,
        "congestion_pct": congestion,
    }


def test_local_federated_model_trains_and_exports_only_weights():
    model = FederatedLinearBaseline()
    for step in range(10):
        model.observe(_summary(step, 20 + step * 2))

    update = model.export_update()
    assert update["version"] == 1
    assert update["sample_count"] == 8
    assert update["source"] == "simulated-edge-observations"
    assert update["validation_mae"] is not None
    assert "vehicle_count" not in update
    assert np.isfinite(model.weights).all()


def test_fedavg_validates_updates_and_uses_sample_counts():
    result = fedavg([[np.array([0.0])], [np.array([10.0])]], [1, 3])
    assert result[0][0] == 7.5

    with pytest.raises(ValueError, match="positive integers"):
        fedavg([[np.array([0.0])]], [0])
