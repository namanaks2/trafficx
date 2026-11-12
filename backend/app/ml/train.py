"""
TrafficX ML Training Script
Generates synthetic training data and trains GradientBoostingRegressor.
Run: python -m app.ml.train
"""
import os
import math
import random
import numpy as np
import pandas as pd

try:
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
    import joblib
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("scikit-learn not available. Install with: pip install scikit-learn joblib")


def generate_synthetic_data(n_samples: int = 10000) -> pd.DataFrame:
    """Generate realistic synthetic traffic data."""
    rows = []
    for _ in range(n_samples):
        hour = random.randint(0, 23)
        day = random.randint(0, 6)
        is_weekend = day >= 5
        is_rush = (7 <= hour <= 9) or (17 <= hour <= 19)
        is_night = hour < 5 or hour > 22

        # Realistic vehicle counts
        base_vehicles = 500 if is_rush else 150 if is_night else 350
        if is_weekend:
            base_vehicles = int(base_vehicles * 0.7)
        vehicle_count = int(base_vehicles + random.gauss(0, 80))
        vehicle_count = max(10, min(1200, vehicle_count))

        # Speed inversely related to congestion
        base_speed = 20 if is_rush else 65 if is_night else 40
        if is_weekend:
            base_speed = min(80, int(base_speed * 1.3))
        avg_speed = max(5, min(120, base_speed + random.gauss(0, 8)))

        # Congestion target
        congestion = 100 - (avg_speed / 80 * 100)
        congestion += random.gauss(0, 5)
        congestion = max(5, min(99, congestion))

        rows.append({
            "vehicle_count": vehicle_count,
            "avg_speed": avg_speed,
            "hour": hour,
            "day_of_week": day,
            "is_weekend": int(is_weekend),
            "hour_sin": math.sin(2 * math.pi * hour / 24),
            "hour_cos": math.cos(2 * math.pi * hour / 24),
            "is_rush_hour": int(is_rush),
            "congestion": congestion,
        })

    return pd.DataFrame(rows)


def train_model(save_path: str = "./app/ml/models/congestion_model.joblib"):
    if not ML_AVAILABLE:
        print("Cannot train — scikit-learn not available.")
        return

    print("Generating synthetic training data...")
    df = generate_synthetic_data(10000)

    features = ["vehicle_count", "avg_speed", "hour", "day_of_week",
                "is_weekend", "hour_sin", "hour_cos", "is_rush_hour"]
    X = df[features].values
    y = df["congestion"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("Training GradientBoostingRegressor...")
    model = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=5,
        min_samples_split=5,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = mean_squared_error(y_test, y_pred) ** 0.5
    r2 = r2_score(y_test, y_pred)

    print(f"\nModel Performance:")
    print(f"  MAE:  {mae:.2f}")
    print(f"  RMSE: {rmse:.2f}")
    print(f"  R²:   {r2:.4f}")

    # Save
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    joblib.dump(model, save_path)
    print(f"\nModel saved to: {save_path}")
    return model


if __name__ == "__main__":
    train_model()
