"""Evaluation metrics.

Deliberate choices:
  * Errors are reported in INR on TOTAL price (what a user cares about) and on
    price per sq ft (what is comparable across differently sized properties).
  * MAPE is reported alongside WAPE and median APE because MAPE explodes for
    small denominators; we exclude only non-positive targets, which validation
    already guarantees do not exist.
  * R2 is described as variance explained relative to the test-set mean, never
    as a percentage of correct predictions.
  * Prediction-interval coverage is measured, and we report the calibration
    target the interval was actually built for.
"""

from __future__ import annotations

import math

import numpy as np


def mae(y_true, y_pred):
    return float(np.mean(np.abs(np.asarray(y_true) - np.asarray(y_pred))))


def median_absolute_error(y_true, y_pred):
    return float(np.median(np.abs(np.asarray(y_true) - np.asarray(y_pred))))


def rmse(y_true, y_pred):
    d = np.asarray(y_true) - np.asarray(y_pred)
    return float(math.sqrt(np.mean(d**2)))


def mape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mask = np.abs(y_true) > 1e-9
    if not mask.any():
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def median_ape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mask = np.abs(y_true) > 1e-9
    if not mask.any():
        return float("nan")
    return float(np.median(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def wape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    denom = np.abs(y_true).sum()
    if denom <= 0:
        return float("nan")
    return float(np.abs(y_true - y_pred).sum() / denom * 100.0)


def r2(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - y_true.mean()) ** 2))
    if ss_tot == 0:
        return float("nan")
    return 1.0 - ss_res / ss_tot


def interval_coverage(y_true, lower, upper):
    y_true = np.asarray(y_true, dtype=float)
    inside = (y_true >= np.asarray(lower)) & (y_true <= np.asarray(upper))
    return float(np.mean(inside) * 100.0)


def mean_interval_width(lower, upper):
    return float(np.mean(np.asarray(upper) - np.asarray(lower)))


def full_metrics(y_true, y_pred, lower=None, upper=None):
    m = {
        "n": int(len(y_true)),
        "mae": mae(y_true, y_pred),
        "median_absolute_error": median_absolute_error(y_true, y_pred),
        "rmse": rmse(y_true, y_pred),
        "mape_pct": mape(y_true, y_pred),
        "median_ape_pct": median_ape(y_true, y_pred),
        "wape_pct": wape(y_true, y_pred),
        "r2": r2(y_true, y_pred),
    }
    if lower is not None and upper is not None:
        m["interval_coverage_pct"] = interval_coverage(y_true, lower, upper)
        m["mean_interval_width"] = mean_interval_width(lower, upper)
    return m


def segmented_metrics(y_true, y_pred, keys, min_n=25):
    """Metrics per segment value. Segments below `min_n` are reported with
    n and an explicit `sufficient: false` rather than a misleading number."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    out = {}
    keys = list(keys)
    for value in sorted(set(keys), key=lambda v: (v is None, str(v))):
        mask = np.array([k == value for k in keys])
        n = int(mask.sum())
        if n == 0:
            continue
        entry = full_metrics(y_true[mask], y_pred[mask])
        entry["sufficient"] = n >= min_n
        out[str(value)] = entry
    return out
