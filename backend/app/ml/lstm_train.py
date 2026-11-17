"""
Train three LSTM heads (t+15, t+30, t+60) and save model + scaler.

Usage:
    python -m app.ml.lstm_train [--dataset synthetic|metr-la] [--epochs N]
                                [--seeds N] [--path FILE] [--strict]

Outputs (all overwritten each run):
    models/lstm_model.keras
    models/lstm_scaler.pkl
    models/lstm_metrics.json
    results/ml_metrics.json   (copy)
    results/ml_comparison.png
"""

import argparse
import json
import os
import shutil
import sys
from datetime import date
from collections import defaultdict

import numpy as np

MODEL_DIR   = os.path.join(os.path.dirname(__file__), "models")
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "results")
os.makedirs(MODEL_DIR, exist_ok=True)

KERAS_PATH   = os.path.join(MODEL_DIR, "lstm_model.keras")
SCALER_PATH  = os.path.join(MODEL_DIR, "lstm_scaler.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "lstm_metrics.json")


# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------
def _mae_rmse(yt, yp):
    yt = np.asarray(yt, dtype=np.float64).ravel()
    yp = np.asarray(yp, dtype=np.float64).ravel()
    mae  = float(np.mean(np.abs(yt - yp)))
    rmse = float(np.sqrt(np.mean((yt - yp) ** 2)))
    mask = yt > 5.0
    mape = float(np.mean(np.abs((yt[mask] - yp[mask]) / yt[mask])) * 100) if mask.sum() > 0 else float("nan")
    return mae, rmse, mape


def _metrics_real(yt, yp, label, indent=4):
    mae, rmse, mape = _mae_rmse(yt, yp)
    pad = " " * indent
    print(f"{pad}[{label:24s}]  MAE={mae:5.2f}  RMSE={rmse:5.2f}  MAPE={mape:5.1f}%")
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "mape": round(mape, 2)}


# ---------------------------------------------------------------------------
# Time-of-day mean baseline
# ---------------------------------------------------------------------------
def _build_tod_lookup(ts_train, cur_train):
    """
    Build a dict: (is_weekend, slot) -> mean congestion on TRAIN only.
    slot = hour*12 + minute//5  (288 slots per day)
    """
    lookup = defaultdict(list)
    for ts, v in zip(ts_train, cur_train):
        slot = ts.hour * 12 + ts.minute // 5
        wknd = int(ts.dayofweek >= 5)
        lookup[(wknd, slot)].append(float(v))
    return {k: float(np.mean(vals)) for k, vals in lookup.items()}


def _apply_tod(tod_lookup, ts_list, global_mean):
    """Apply TOD lookup to a list of timestamps; fall back to global_mean."""
    out = np.empty(len(ts_list), dtype=np.float32)
    for i, ts in enumerate(ts_list):
        slot = ts.hour * 12 + ts.minute // 5
        wknd = int(ts.dayofweek >= 5)
        out[i] = tod_lookup.get((wknd, slot), global_mean)
    return out


# ---------------------------------------------------------------------------
# Model builder (re-used across seeds)
# ---------------------------------------------------------------------------
def _build_model(keras, seq_len, n_features):
    inp   = keras.Input(shape=(seq_len, n_features), name="seq_input")
    x     = keras.layers.LSTM(64, return_sequences=True, name="lstm1")(inp)
    x     = keras.layers.Dropout(0.2)(x)
    x     = keras.layers.LSTM(32, name="lstm2")(x)
    x     = keras.layers.Dropout(0.2)(x)
    x     = keras.layers.Dense(32, activation="relu")(x)
    out15 = keras.layers.Dense(1, name="pred_15")(x)
    out30 = keras.layers.Dense(1, name="pred_30")(x)
    out60 = keras.layers.Dense(1, name="pred_60")(x)
    model = keras.Model(inputs=inp, outputs=[out15, out30, out60])
    model.compile(
        optimizer=keras.optimizers.Adam(1e-3),
        loss={"pred_15": "mse", "pred_30": "mse", "pred_60": "mse"},
        metrics={"pred_15": "mae", "pred_30": "mae", "pred_60": "mae"},
    )
    return model


# ---------------------------------------------------------------------------
# Breakdown helper
# ---------------------------------------------------------------------------
def _breakdown(yt, yp, tod_pred, pers_pred, is_rush_arr, is_incident_arr):
    """
    Return dict with mae for lstm/tod/persistence across all/rush/incident rows.
    is_rush_arr and is_incident_arr are integer arrays aligned with yt.
    """
    subsets = {
        "all":      np.ones(len(yt), dtype=bool),
        "rush":     is_rush_arr.astype(bool),
        "incident": is_incident_arr.astype(bool),
    }
    result = {}
    for name, mask in subsets.items():
        n = mask.sum()
        if n == 0:
            result[name] = {"n": 0, "lstm_mae": None, "tod_mae": None, "pers_mae": None}
            continue
        result[name] = {
            "n":        int(n),
            "lstm_mae": round(float(np.mean(np.abs(yt[mask] - yp[mask]))), 4),
            "tod_mae":  round(float(np.mean(np.abs(yt[mask] - tod_pred[mask]))), 4),
            "pers_mae": round(float(np.mean(np.abs(yt[mask] - pers_pred[mask]))), 4),
        }
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run(args=None):
    parser = argparse.ArgumentParser(description="Train TrafficX LSTM")
    parser.add_argument("--dataset", choices=["synthetic", "metr-la"], default="synthetic")
    parser.add_argument("--epochs",  type=int, default=20)
    parser.add_argument("--seeds",   type=int, default=3,
                        help="Number of seeds (42, 43, ...).  Final model uses seed 42.")
    parser.add_argument("--path",    type=str, default=None)
    parser.add_argument("--strict",  action="store_true")
    cfg = parser.parse_args(args)

    # TF / Keras
    try:
        import keras
        import tensorflow as tf  # noqa: F401 — needed to register ops
    except ImportError:
        print("TensorFlow not installed.  Run: pip install tensorflow-cpu")
        sys.exit(1)

    from .preprocessing import (
        FEATURES, SEQ_LEN, HORIZONS,
        generate_dataset, build_splits, inv_target, load_metr_la,
    )

    horizon_keys = list(HORIZONS.keys())   # ["15","30","60"]

    # -- Dataset --------------------------------------------------------------
    if cfg.dataset == "metr-la":
        metr_path = cfg.path or os.getenv("METR_LA_PATH", "")
        print(f"Loading METR-LA from {metr_path} ...")
        df = load_metr_la(metr_path)
    else:
        print("Generating synthetic dataset (60 days, 5 roads, seed=42) ...")
        df = generate_dataset(days=60, roads=5, seed=42)
    print(f"Dataset shape: {df.shape}")

    # -- Splits (data doesn't change across seeds) ----------------------------
    print("Building train/val/test splits ...")
    sp = build_splits(df, SCALER_PATH)
    scaler = sp["scaler"]

    X_tr  = sp["X_train"];   X_va  = sp["X_val"];   X_te  = sp["X_test"]
    y15tr = sp["y15_train"]; y15va = sp["y15_val"]; y15te = sp["y15_test"]
    y30tr = sp["y30_train"]; y30va = sp["y30_val"]; y30te = sp["y30_test"]
    y60tr = sp["y60_train"]; y60va = sp["y60_val"]; y60te = sp["y60_test"]
    cur_tr = sp["cur_train"]; cur_te = sp["cur_test"]
    ts_tr  = sp["ts_train"];  ts_te  = sp["ts_test"]
    inc_te = sp["is_incident_test"]

    print(f"  train {X_tr.shape}  val {X_va.shape}  test {X_te.shape}")

    # -- Ground truth in real units ------------------------------------------
    y15_real = inv_target(scaler, y15te)
    y30_real = inv_target(scaler, y30te)
    y60_real = inv_target(scaler, y60te)

    # -- Time-of-day baseline (from TRAIN only) --------------------------------
    tod_lookup   = _build_tod_lookup(ts_tr, cur_tr)
    global_mean  = float(np.mean(cur_tr))
    tod_te       = _apply_tod(tod_lookup, ts_te, global_mean)

    # -- Train-mean baseline --------------------------------------------------
    train_mean  = float(np.mean(cur_tr))
    tm_arr_te   = np.full(len(cur_te), train_mean, dtype=np.float32)

    # Persistence baseline
    pers_te = cur_te

    # -- Rush flag for test rows (derived from timestamps, not from is_rush feature)
    rush_te = np.array([
        int((7.0 <= (ts.hour + ts.minute/60.0) < 9.5) or
            (16.0 <= (ts.hour + ts.minute/60.0) < 19.0))
        for ts in ts_te
    ], dtype=np.int8)

    # -- Multi-seed training loop --------------------------------------------
    seeds = list(range(42, 42 + cfg.seeds))
    # Accumulate per-seed metrics
    seed_metrics = {hk: {"lstm_mae": [], "lstm_rmse": [],
                          "tod_mae":  [], "pers_mae":  [],
                          "tm_mae":   []}
                    for hk in horizon_keys}

    # Store predictions from the CANONICAL seed (42) for the final artefacts
    canon_preds = {}

    for seed_idx, seed in enumerate(seeds):
        print(f"\n{'='*60}")
        print(f"  Seed {seed}  ({seed_idx+1}/{len(seeds)})")
        print(f"{'='*60}")
        keras.utils.set_random_seed(seed)

        model = _build_model(keras, SEQ_LEN, len(FEATURES))
        if seed_idx == 0:
            model.summary()

        cb = [
            keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True, monitor="val_loss"),
            keras.callbacks.ReduceLROnPlateau(patience=3, factor=0.5, verbose=0),
        ]
        model.fit(
            X_tr,
            {"pred_15": y15tr, "pred_30": y30tr, "pred_60": y60tr},
            validation_data=(X_va, {"pred_15": y15va, "pred_30": y30va, "pred_60": y60va}),
            epochs=cfg.epochs, batch_size=256, callbacks=cb, verbose=1,
        )

        p15_sc, p30_sc, p60_sc = model.predict(X_te, verbose=0)
        p15r = inv_target(scaler, p15_sc.flatten())
        p30r = inv_target(scaler, p30_sc.flatten())
        p60r = inv_target(scaler, p60_sc.flatten())

        preds_by_h = {"15": (y15_real, p15r),
                      "30": (y30_real, p30r),
                      "60": (y60_real, p60r)}

        for hk, (yt, yp) in preds_by_h.items():
            m_lstm = _mae_rmse(yt, yp)
            m_tod  = _mae_rmse(yt, tod_te)
            m_pers = _mae_rmse(yt, pers_te)
            m_tm   = _mae_rmse(yt, tm_arr_te)
            seed_metrics[hk]["lstm_mae"].append(m_lstm[0])
            seed_metrics[hk]["lstm_rmse"].append(m_lstm[1])
            seed_metrics[hk]["tod_mae"].append(m_tod[0])
            seed_metrics[hk]["pers_mae"].append(m_pers[0])
            seed_metrics[hk]["tm_mae"].append(m_tm[0])

        if seed == 42:
            canon_preds = {"15": p15r, "30": p30r, "60": p60r}
            # Save canonical model
            model.save(KERAS_PATH)
            print(f"  Canonical model saved -> {KERAS_PATH}")

    # -- Aggregate across seeds ----------------------------------------------
    print("\n\n" + "="*72)
    print("  MULTI-SEED SUMMARY  (mean ± std  over seeds: "
          + ", ".join(str(s) for s in seeds) + ")")
    print("="*72)

    per_horizon = {}
    for hk in horizon_keys:
        sm   = seed_metrics[hk]
        yt   = {"15": y15_real, "30": y30_real, "60": y60_real}[hk]
        yp   = canon_preds[hk]
        tod  = tod_te
        pers = pers_te

        # single-seed (seed 42) metrics for the breakdown and JSON
        m_lstm = _mae_rmse(yt, yp)
        m_tod  = _mae_rmse(yt, tod)
        m_pers = _mae_rmse(yt, pers)
        m_tm   = _mae_rmse(yt, tm_arr_te)

        # breakdown
        bd = _breakdown(yt, yp, tod, pers, rush_te, inc_te)

        per_horizon[hk] = {
            "lstm":        {"mae": round(m_lstm[0],4), "rmse": round(m_lstm[1],4), "mape": round(m_lstm[2],2)},
            "persistence": {"mae": round(m_pers[0],4), "rmse": round(m_pers[1],4), "mape": round(m_pers[2],2)},
            "train_mean":  {"mae": round(m_tm[0],4),   "rmse": round(m_tm[1],4),   "mape": round(m_tm[2],2)},
            "tod_mean":    {"mae": round(m_tod[0],4),  "rmse": round(m_tod[1],4),  "mape": round(m_tod[2],2)},
            "multi_seed": {
                "lstm_mae_mean": round(float(np.mean(sm["lstm_mae"])), 4),
                "lstm_mae_std":  round(float(np.std(sm["lstm_mae"])),  4),
                "lstm_rmse_mean":round(float(np.mean(sm["lstm_rmse"])),4),
                "lstm_rmse_std": round(float(np.std(sm["lstm_rmse"])), 4),
                "tod_mae_mean":  round(float(np.mean(sm["tod_mae"])),  4),
                "pers_mae_mean": round(float(np.mean(sm["pers_mae"])), 4),
                "tm_mae_mean":   round(float(np.mean(sm["tm_mae"])),   4),
            },
            "breakdown": bd,
        }

    # -- Warnings -------------------------------------------------------------
    warnings = []
    for hk in horizon_keys:
        lm = per_horizon[hk]["lstm"]["mae"]
        tm = per_horizon[hk]["train_mean"]["mae"]
        if lm >= tm:
            warnings.append(
                f"[WARNING] LSTM MAE at +{hk} min ({lm:.2f}) does NOT beat "
                f"train-mean ({tm:.2f})"
            )
    h15_lstm = per_horizon["15"]["lstm"]["mae"]
    h15_pers = per_horizon["15"]["persistence"]["mae"]
    if h15_lstm > h15_pers:
        warnings.append(
            f"[WARNING] LSTM MAE at +15 min ({h15_lstm:.2f}) does NOT beat "
            f"persistence ({h15_pers:.2f})"
        )
    for w in warnings:
        print(w)
    if warnings and cfg.strict:
        sys.exit(1)

    # -- Save metrics ---------------------------------------------------------
    metrics_doc = {
        "dataset":       cfg.dataset,
        "units":         "congestion_%",
        "seeds":         seeds,
        "training_date": date.today().isoformat(),
        "horizons":      per_horizon,
    }
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics_doc, f, indent=2)
    os.makedirs(RESULTS_DIR, exist_ok=True)
    shutil.copy2(METRICS_PATH, os.path.join(RESULTS_DIR, "ml_metrics.json"))
    print(f"\nMetrics saved -> {METRICS_PATH}")
    print(f"Scaler saved  -> {SCALER_PATH}")

    # -- Bar chart ------------------------------------------------------------
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        h_labels = ["+15 min", "+30 min", "+60 min"]
        lstm_maes = [per_horizon[k]["lstm"]["mae"]        for k in horizon_keys]
        pers_maes = [per_horizon[k]["persistence"]["mae"] for k in horizon_keys]
        tm_maes   = [per_horizon[k]["train_mean"]["mae"]  for k in horizon_keys]
        tod_maes  = [per_horizon[k]["tod_mean"]["mae"]    for k in horizon_keys]
        stds      = [per_horizon[k]["multi_seed"]["lstm_mae_std"] for k in horizon_keys]

        x     = np.arange(len(h_labels))
        width = 0.20
        fig, ax = plt.subplots(figsize=(10, 5))
        bars = ax.bar(x - 1.5*width, lstm_maes,  width, label="LSTM",          color="steelblue",   yerr=stds, capsize=4)
        ax.bar(x - 0.5*width,        pers_maes,  width, label="Persistence",    color="darkorange")
        ax.bar(x + 0.5*width,        tod_maes,   width, label="TOD-mean",       color="mediumseagreen")
        ax.bar(x + 1.5*width,        tm_maes,    width, label="Train-mean",     color="gray")
        ax.set_xticks(x)
        ax.set_xticklabels(h_labels)
        ax.set_ylabel("MAE (congestion %)")
        ax.set_title(f"LSTM vs Baselines — Test Set MAE  (seeds: {seeds})")
        ax.legend()
        plt.tight_layout()
        plot_path = os.path.join(RESULTS_DIR, "ml_comparison.png")
        plt.savefig(plot_path, dpi=120)
        plt.close()
        print(f"Plot   saved -> {plot_path}")
    except Exception as e:
        print(f"[INFO] plot skipped: {e}")

    # -- Final table ----------------------------------------------------------
    print()
    print("┌─────────────────────────────────────────────────────────────────────────────────────────┐")
    print("│           FINAL METRICS — congestion % (real units, seed=42 single-run)                 │")
    print("├──────────┬────────────┬────────────┬────────────┬────────────┬────────────────────────── ┤")
    print("│ Horizon  │  LSTM MAE  │  LSTM RMSE │  Pers. MAE │  TOD MAE   │  TrainMean MAE            │")
    print("├──────────┼────────────┼────────────┼────────────┼────────────┼─────────────────────────── ┤")
    for hk, hl in zip(horizon_keys, ["+15 min", "+30 min", "+60 min"]):
        lm = per_horizon[hk]["lstm"]["mae"]
        lr = per_horizon[hk]["lstm"]["rmse"]
        pm = per_horizon[hk]["persistence"]["mae"]
        td = per_horizon[hk]["tod_mean"]["mae"]
        tm = per_horizon[hk]["train_mean"]["mae"]
        print(f"│ {hl}  │   {lm:6.3f}   │   {lr:6.3f}   │   {pm:6.3f}   │   {td:6.3f}   │   {tm:6.3f}                   │")
    print("├──────────┴────────────┴────────────┴────────────┴────────────┴─────────────────────────── ┤")
    print("│  MULTI-SEED (mean ± std)                                                                  │")
    print("├──────────┬──────────────────────────┬────────────────────────────────────────────────────┤")
    for hk, hl in zip(horizon_keys, ["+15 min", "+30 min", "+60 min"]):
        ms = per_horizon[hk]["multi_seed"]
        print(f"│ {hl}  │  LSTM {ms['lstm_mae_mean']:.3f} ± {ms['lstm_mae_std']:.3f}      │  TOD {ms['tod_mae_mean']:.3f}  Pers {ms['pers_mae_mean']:.3f}  TM {ms['tm_mae_mean']:.3f}  │")
    print("├──────────┴──────────────────────────┴────────────────────────────────────────────────────┤")
    print("│  BREAKDOWN (seed=42, +60 min target used for incident flag)                               │")
    print("├──────────┬────────────┬────────────────────────────────────────────────────────────────── ┤")
    print("│ Horizon  │  Subset    │  N rows │  LSTM MAE  │  TOD MAE   │  Pers MAE                    │")
    print("├──────────┼────────────┼─────────┼────────────┼────────────┼──────────────────────────────┤")
    for hk, hl in zip(horizon_keys, ["+15 min", "+30 min", "+60 min"]):
        bd = per_horizon[hk]["breakdown"]
        for sub in ("all", "rush", "incident"):
            row = bd[sub]
            if row["n"] == 0:
                print(f"│ {hl}  │ {sub:10s} │       0 │     --     │     --     │     --                       │")
            else:
                print(f"│ {hl}  │ {sub:10s} │ {row['n']:7d} │  {row['lstm_mae']:7.3f}   │  {row['tod_mae']:7.3f}   │  {row['pers_mae']:7.3f}                │")
    print("└──────────┴────────────┴─────────┴────────────┴────────────┴──────────────────────────────┘")

    return metrics_doc


if __name__ == "__main__":
    run()
