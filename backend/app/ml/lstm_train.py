"""
Train three LSTM heads (t+15, t+30, t+60) and save model + scaler.
Run:  python -m app.ml.lstm_train
"""
import os, sys, math
import numpy as np
import pandas as pd
import joblib

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

KERAS_PATH  = os.path.join(MODEL_DIR, "lstm_model.keras")
SCALER_PATH = os.path.join(MODEL_DIR, "lstm_scaler.pkl")

def run():
    # ── TensorFlow import (delayed so non-TF path still works) ──────────────
    try:
        import tensorflow as tf
        from tensorflow import keras
    except ImportError:
        print("TensorFlow not installed. Run: pip install tensorflow-cpu==2.16.2")
        sys.exit(1)

    from .preprocessing import generate_dataset, build_sequences, FEATURES, SEQ_LEN

    print("Generating synthetic training data (15 000 rows)...")
    df = generate_dataset(15000)
    X, y15, y30, y60, scaler = build_sequences(df, SCALER_PATH)
    print(f"Sequences: X={X.shape}  y15={y15.shape}")

    # ── Chronological split (no random shuffle for time-series) ─────────────
    n       = len(X)
    n_train = int(n * 0.70)
    n_val   = int(n * 0.15)

    Xtr, ytr15, ytr30, ytr60 = X[:n_train], y15[:n_train], y30[:n_train], y60[:n_train]
    Xv,  yv15,  yv30,  yv60  = X[n_train:n_train+n_val], y15[n_train:n_train+n_val], y30[n_train:n_train+n_val], y60[n_train:n_train+n_val]
    Xte, yte15, yte30, yte60 = X[n_train+n_val:],        y15[n_train+n_val:],        y30[n_train+n_val:],        y60[n_train+n_val:]

    # ── Build multi-output LSTM ──────────────────────────────────────────────
    inp = keras.Input(shape=(SEQ_LEN, len(FEATURES)), name="seq_input")
    x   = keras.layers.LSTM(64, return_sequences=True, name="lstm1")(inp)
    x   = keras.layers.Dropout(0.2)(x)
    x   = keras.layers.LSTM(32, name="lstm2")(x)
    x   = keras.layers.Dropout(0.2)(x)
    x   = keras.layers.Dense(32, activation="relu")(x)

    out15 = keras.layers.Dense(1, name="pred_15")(x)
    out30 = keras.layers.Dense(1, name="pred_30")(x)
    out60 = keras.layers.Dense(1, name="pred_60")(x)

    model = keras.Model(inputs=inp, outputs=[out15, out30, out60])
    model.compile(
        optimizer=keras.optimizers.Adam(1e-3),
        loss={"pred_15": "mse", "pred_30": "mse", "pred_60": "mse"},
        metrics={"pred_15": "mae", "pred_30": "mae", "pred_60": "mae"},
    )
    model.summary()

    cb = [
        keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True, monitor="val_loss"),
        keras.callbacks.ReduceLROnPlateau(patience=3, factor=0.5),
    ]

    model.fit(
        Xtr, {"pred_15": ytr15, "pred_30": ytr30, "pred_60": ytr60},
        validation_data=(Xv, {"pred_15": yv15, "pred_30": yv30, "pred_60": yv60}),
        epochs=40, batch_size=256, callbacks=cb, verbose=1,
    )

    # ── Evaluation on hold-out test set ─────────────────────────────────────
    p15, p30, p60 = model.predict(Xte, verbose=0)

    def metrics(y_true, y_pred, label):
        y_true = y_true.flatten();  y_pred = y_pred.flatten()
        mae  = float(np.mean(np.abs(y_true - y_pred)))
        rmse = float(np.sqrt(np.mean((y_true - y_pred)**2)))
        mask = y_true > 0.01
        mape = float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100) if mask.sum() else float("nan")
        print(f"  [{label}]  MAE={mae:.4f}  RMSE={rmse:.4f}  MAPE={mape:.1f}%")
        return {"mae": round(mae, 4), "rmse": round(rmse, 4), "mape": round(mape, 2)}

    print("\n── Test-set metrics (normalised scale) ──")
    m15 = metrics(yte15, p15, "+15 min")
    m30 = metrics(yte30, p30, "+30 min")
    m60 = metrics(yte60, p60, "+60 min")

    # Persist metrics alongside model
    import json
    with open(os.path.join(MODEL_DIR, "lstm_metrics.json"), "w") as f:
        json.dump({"t15": m15, "t30": m30, "t60": m60}, f)

    model.save(KERAS_PATH)
    print(f"\nModel saved → {KERAS_PATH}")
    print(f"Scaler saved → {SCALER_PATH}")


if __name__ == "__main__":
    run()
