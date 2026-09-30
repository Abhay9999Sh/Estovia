"""Conformal prediction intervals.

Split-conformal on the ABSOLUTE RELATIVE error, calibrated on a held-out
calibration set that is disjoint from both the training set and the test set.

Why relative error: a fixed rupee band is meaningless across NCR (a
₹50L studio and a ₹12 Cr villa need different absolute tolerances). We
calibrate q = the 1-alpha quantile of |y - yhat| / y on calibration data,
then the interval is [yhat*(1-q), yhat*(1+q)].

Honesty rules baked in:
  * The reported coverage is measured on the test set, not assumed from alpha.
  * `nominal_coverage` is what the interval was BUILT for; `interval_coverage_pct`
    is what actually happened. If they diverge, the report says so.
  * Small calibration sets make split-conformal noisy; we return the
    calibration n alongside so the admin can judge.
"""

from __future__ import annotations

import numpy as np


def relative_errors(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    denom = np.where(np.abs(y_true) > 1e-9, np.abs(y_true), np.nan)
    return np.abs(y_true - y_pred) / denom


def fit_relative_conformal(y_cal_true, y_cal_pred, alpha=0.10):
    errs = relative_errors(y_cal_true, y_cal_pred)
    errs = errs[np.isfinite(errs)]
    if errs.size == 0:
        return {"q": float("nan"), "alpha": alpha, "n_calibration": 0}
    # Finite-sample corrected quantile: ceil((n+1)*(1-alpha))/n
    n = errs.size
    level = min(1.0, math_ceil(n + 1, 1 - alpha) / n)
    q = float(np.quantile(errs, level, method="higher"))
    return {"q": q, "alpha": alpha, "n_calibration": int(n), "method": "split_conformal_relative_error"}


def math_ceil(a, b):
    import math

    return math.ceil(a * b)


def apply_relative_conformal(y_pred, conformal):
    q = conformal.get("q")
    if q is None or not np.isfinite(q):
        return y_pred, y_pred, y_pred
    y_pred = np.asarray(y_pred, dtype=float)
    lower = y_pred * (1.0 - q)
    upper = y_pred * (1.0 + q)
    return lower, y_pred, upper
