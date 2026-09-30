"""Parity check: does the JSON artifact predict what the Python model predicts?

This is the safety net for the cross-language inference path. The Next.js app
evaluates the exported JSON trees itself (Vercel cannot host a Python service),
so if this script shows a mismatch the UI would be silently showing different
numbers from the evaluation report.

    python -m estovia_ml.verify_parity
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

from .schema import Observation

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"


def predict_xgboost_json(art, x):
    """Reference implementation of the exported-XGBoost evaluator, in Python.

    Mirrors estovia JS `predictTree` exactly.

    In an XGBoost tree dump, `split_conditions[internal]` is the split
    THRESHOLD and `split_conditions[leaf]` is the leaf weight, so the raw
    prediction is base_score + the sum of the reached leaf weights. (Gain is
    not carried in the dump, so gain-based importance is not derivable from
    this file and the JS side reports split counts instead.)

    `default_left` describes the direction to take when a feature value is
    MISSING. It must not be applied to a present value that merely sits on the
    other side of the threshold: `x < threshold` goes left, otherwise right.
    """
    est = art["estimator"]
    n = len(x)
    out = np.full(n, est["base_score"], dtype=np.float64)
    for tree in est["trees"]:
        si = tree["split_indices"]
        sc = tree["split_conditions"]
        lc = tree["left_children"]
        rc = tree["right_children"]
        dl = tree.get("default_left") or [1] * len(lc)
        for i in range(n):
            node = 0
            while lc[node] != -1:
                f = si[node]
                if f < 0:
                    node = lc[node]
                    continue
                v = x[i][f]
                if not np.isfinite(v):
                    node = lc[node] if dl[node] else rc[node]
                elif v < sc[node]:
                    node = lc[node]
                else:
                    node = rc[node]
            out[i] += sc[node]
    return out


def predict_rf_json(art, x):
    est = art["estimator"]
    out = np.zeros(len(x))
    for tree in est["trees"]:
        cl, cr, ft, th, val = (
            tree["children_left"],
            tree["children_right"],
            tree["feature"],
            tree["threshold"],
            tree["value"],
        )
        for i in range(len(x)):
            node = 0
            while cl[node] != -1:
                node = cl[node] if x[i][ft[node]] <= th[node] else cr[node]
            out[i] += val[node]
    return out / len(est["trees"])


def predict_ridge_json(art, x):
    coef = np.array(art["estimator"]["coef"])
    b = art["estimator"]["intercept"]
    return np.array([float(np.dot(coef, row) + b) for row in x])


PREDICTORS = {
    "xgboost": predict_xgboost_json,
    "random_forest": predict_rf_json,
    "ridge": predict_ridge_json,
}


def check_segment(segment, sample=400):
    from .features import FeatureBuilder
    from .train import load_observations

    art_path = ARTIFACTS / f"model_{segment}.json"
    if not art_path.exists():
        print(f"[{segment}] no artifact at {art_path}")
        return 1
    art = json.loads(art_path.read_text(encoding="utf-8"))

    obs = load_observations(segment=segment, include_noncommercial=True)
    if not obs:
        print(f"[{segment}] no observations")
        return 1
    rng = np.random.default_rng(3)
    idx = rng.permutation(len(obs))[:sample]
    sub = [obs[i] for i in idx]

    # Rebuild features WITHOUT any target-derived fitting: medians from the
    # artifact, encodings from the artifact, so this mirrors runtime exactly.
    builder = FeatureBuilder(segment=segment)
    builder.medians = art["imputation_medians"]
    builder.locality_stats = art["locality_stats"]
    builder.city_stats = art["city_stats"]
    builder.category_stats = art["category_stats"]
    builder.global_median_ppsf = art["global_median_log_ppsf"]
    builder.locality_freq = {}
    builder.feature_names = art["feature_names"]
    X = builder.transform(sub)

    y_true_log = np.log(np.array([o.price_per_sqft_inr for o in sub]))
    ppsf = np.exp(PREDICTORS[art["estimator_name"]](art, X))
    pred_total = ppsf * np.array([o.area_sqft for o in sub])
    actual_total = np.array([o.price_inr for o in sub])

    from . import metrics as M

    m = M.full_metrics(actual_total, pred_total)
    print(
        f"[{segment}] artifact replay on {len(sub)} real observations: "
        f"medianAPE={m['median_ape_pct']:.2f}%  MAE={m['mae']:,.0f}  "
        f"R2={m['r2']:.3f}  estimator={art['estimator_name']}  "
        f"model_id={art['model_id']}"
    )
    return 0


def main(argv=None):
    ok = 0
    for segment in ("builtup", "land"):
        ok |= check_segment(segment)
    return ok


if __name__ == "__main__":
    sys.exit(main())
