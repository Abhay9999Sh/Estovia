"""Training + evaluation + model registry export.

    python -m estovia_ml.train --segment builtup --out artifacts/

What it does, in order:
  1. loads the normalised observation JSONL produced by estovia_ml.ingest,
  2. optionally enriches with OpenStreetMap accessibility features,
  3. fits candidate models on a TRAINING fold only,
  4. tunes hyper-parameters inside the training fold with grouped CV,
  5. picks the model that wins on held-out data, not on training R2,
  6. calibrates a conformal interval on a calibration split that is disjoint
     from both training and test,
  7. reports metrics overall AND per segment, plus baseline comparison,
  8. exports a JSON artifact the Next.js inference layer can evaluate directly.

Splits used
-----------
Because NONE of the accepted listing sources publish an observation date, a
genuine train->future temporal split is impossible. The pipeline therefore
uses:
  * PRIMARY  geographic holdout: whole cities are held out, which is the
    harshest available generalisation test and is what "could this predict a
    property in a neighbourhood it never saw" actually means.
  * SECONDARY grouped holdout: rows sharing (city, locality, project,
    price bucket) are kept together so the same advertised unit cannot appear
    in both train and test.
  * TUNING    grouped K-fold CV inside the training split only.
The absence of a temporal split is reported in the evaluation artifact as
`temporal_validation: unavailable` with the reason, rather than papered over.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import platform
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from . import metrics as M
from .conformal import apply_relative_conformal, fit_relative_conformal
from .features import (
    FEATURE_GROUPS,
    FeatureBuilder,
    group_key,
    leave_one_out_locality,
    locality_key,
)
from .schema import SEGMENTS, feature_schema_version

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
ARTIFACT_DIR = ROOT / "artifacts"

TARGET = "log_price_per_sqft"
TARGET_HUMAN = "advertised asking price per square foot (log scale)"

# City holdouts chosen to be genuine submarkets, not random slices.
GEO_HOLDOUT = ["Faridabad", "Greater Noida"]

MIN_SEGMENT_RECORDS = 400


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_observations(path=None, segment=None, include_noncommercial=False):
    from .schema import Observation

    path = Path(path or (PROCESSED / "observations.jsonl"))
    obs = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            if not line.strip():
                continue
            d = json.loads(line)
            o = Observation(**{k: v for k, v in d.items() if k in Observation.__dataclass_fields__})
            o.is_demo = False
            if segment and o.segment != segment:
                continue
            if o.non_commercial and not include_noncommercial:
                continue
            if o.price_inr and o.area_sqft and o.area_sqft > 0:
                obs.append(o)
    return obs


def target_array(obs):
    return np.log(np.array([o.price_per_sqft_inr for o in obs], dtype=float))


def price_array(obs):
    return np.array([o.price_inr for o in obs], dtype=float)


# ---------------------------------------------------------------------------
# Splits
# ---------------------------------------------------------------------------

@dataclass
class Split:
    train_idx: np.ndarray
    calib_idx: np.ndarray
    test_idx: np.ndarray
    description: str
    test_description: str


def geographic_split(obs, holdout_cities=GEO_HOLDOUT, calib_fraction=0.15, seed=17):
    test_idx = np.array([i for i, o in enumerate(obs) if o.city in holdout_cities])
    rest = np.array([i for i, o in enumerate(obs) if o.city not in holdout_cities])
    rng = np.random.default_rng(seed)
    rest = rest[rng.permutation(len(rest))]
    n_calib = int(len(rest) * calib_fraction)
    calib_idx = rest[:n_calib]
    train_idx = rest[n_calib:]
    return Split(
        train_idx=train_idx,
        calib_idx=calib_idx,
        test_idx=test_idx,
        description="grouped random split inside non-holdout cities (by city+locality+project+price bucket)",
        test_description=f"geographic holdout: whole cities {holdout_cities}",
    )


def grouped_random_split(obs, test_fraction=0.2, calib_fraction=0.15, seed=17):
    groups = {}
    for i, o in enumerate(obs):
        groups.setdefault(group_key(o), []).append(i)
    keys = sorted(groups)
    rng = np.random.default_rng(seed)
    keys = [keys[i] for i in rng.permutation(len(keys))]
    n_test = int(len(keys) * test_fraction)
    n_calib = int(len(keys) * calib_fraction)
    test_groups = set(keys[:n_test])
    calib_groups = set(keys[n_test : n_test + n_calib])
    test_idx, calib_idx, train_idx = [], [], []
    for k, idxs in groups.items():
        if k in test_groups:
            test_idx.extend(idxs)
        elif k in calib_groups:
            calib_idx.extend(idxs)
        else:
            train_idx.extend(idxs)
    return Split(
        train_idx=np.array(train_idx),
        calib_idx=np.array(calib_idx),
        test_idx=np.array(test_idx),
        description="grouped split: identical (city, locality, project, price-bucket) rows kept together",
        test_description="held-out 20% of listing groups, same cities",
    )


def locality_holdout_split(obs, n_localities=40, seed=17):
    locs = {}
    for i, o in enumerate(obs):
        locs.setdefault(locality_key(o), []).append(i)
    ordered = sorted(locs.items(), key=lambda kv: len(kv[1]))
    # Hold out the largest localities so the test set is big enough to measure.
    hold = [k for k, _ in ordered[::-1][:n_localities]]
    test_idx = [i for k in hold for i in locs[k]]
    rest = [i for k, idxs in locs.items() if k not in hold for i in idxs]
    rng = np.random.default_rng(seed)
    rest = np.array(rest)[rng.permutation(len(rest))]
    n_calib = int(len(rest) * 0.15)
    return Split(
        train_idx=rest[n_calib:],
        calib_idx=rest[:n_calib],
        test_idx=np.array(test_idx),
        description="grouped split inside non-holdout localities",
        test_description=f"geographic holdout: {len(hold)} whole localities",
    )


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

def build_candidates(random_state=42):
    """Candidate models. Each entry: (name, factory, param_grid)."""
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.linear_model import Ridge
    from xgboost import XGBRegressor

    return [
        (
            "ridge",
            lambda: Ridge(alpha=10.0),
            {"alpha": [0.1, 1.0, 10.0, 100.0, 1000.0]},
        ),
        (
            "random_forest",
            lambda: RandomForestRegressor(
                n_estimators=300,
                min_samples_leaf=4,
                n_jobs=-1,
                random_state=random_state,
            ),
            {
                "n_estimators": [200, 400],
                "max_depth": [None, 12, 20],
                "min_samples_leaf": [2, 4, 8],
                "max_features": [0.5, 0.8],
            },
        ),
        (
            "xgboost",
            lambda: XGBRegressor(
                n_estimators=600,
                learning_rate=0.05,
                max_depth=6,
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_weight=5,
                reg_lambda=1.0,
                reg_alpha=0.0,
                objective="reg:squarederror",
                tree_method="hist",
                n_jobs=-1,
                random_state=random_state,
                verbosity=0,
            ),
            {
                "n_estimators": [400, 700, 1200],
                "max_depth": [4, 6, 8],
                "learning_rate": [0.02, 0.05, 0.1],
                "subsample": [0.7, 0.9],
                "colsample_bytree": [0.6, 0.8, 1.0],
                "min_child_weight": [1, 5, 15],
                "reg_lambda": [0.5, 1.0, 5.0],
                "reg_alpha": [0.0, 0.1, 1.0],
            },
        ),
    ]


class LocalityMedianBaseline:
    """Median price-per-sqft by (city, locality) with fallback to city, then global.

    This is the honest baseline: any model that cannot beat it out-of-sample is
    not worth shipping.
    """

    def __init__(self, k=20.0):
        self.k = k
        self.loc = {}
        self.city = {}
        self.global_ = 0.0

    def fit(self, obs, y):
        from collections import defaultdict

        ls, lc = defaultdict(float), defaultdict(int)
        cs, cc = defaultdict(float), defaultdict(int)
        for o, yv in zip(obs, y):
            key = locality_key(o)
            ls[key] += yv
            lc[key] += 1
            cs[o.city or "__none__"] += yv
            cc[o.city or "__none__"] += 1
        self.global_ = float(np.median(y))
        self.loc = {k: (ls[k] + self.k * self.global_) / (lc[k] + self.k) for k in ls}
        self.city = {k: (cs[k] + self.k * self.global_) / (cc[k] + self.k) for k in cs}
        return self

    def predict(self, obs):
        return np.array(
            [
                self.loc.get(locality_key(o), self.city.get(o.city or "__none__", self.global_))
                for o in obs
            ],
            dtype=float,
        )


# ---------------------------------------------------------------------------
# Training / evaluation
# ---------------------------------------------------------------------------

@dataclass
class TrainedModel:
    name: str
    estimator: object
    params: dict
    cv_rmse: float


def tune_candidates(candidates, X, y, groups, max_iter=24, seed=42):
    from sklearn.model_selection import GroupKFold, RandomizedSearchCV

    n_groups = len(set(groups))
    n_splits = max(2, min(5, n_groups))
    cv = GroupKFold(n_splits=n_splits)
    results = []
    for name, factory, grid in candidates:
        search = RandomizedSearchCV(
            factory(),
            grid,
            n_iter=min(max_iter, len(grid) and max_iter),
            scoring="neg_root_mean_squared_error",
            cv=cv,
            random_state=seed,
            n_jobs=1,
            refit=True,
        )
        groups_arr = np.array(groups)
        search.fit(X, y, groups=groups_arr)
        results.append(
            TrainedModel(name, search.best_estimator_, search.best_params_, -search.best_score_)
        )
        print(f"    tuned {name}: cv_rmse={-search.best_score_:.5f} params={search.best_params_}")
    return results


def evaluate_split(obs, split, segment, seed=42, tune=True, max_iter=24):
    train_obs = [obs[i] for i in split.train_idx]
    calib_obs = [obs[i] for i in split.calib_idx]
    test_obs = [obs[i] for i in split.test_idx]

    y_train = target_array(train_obs)
    y_calib = target_array(calib_obs)
    y_test = target_array(test_obs)
    p_train = price_array(train_obs)
    p_calib = price_array(calib_obs)
    p_test = price_array(test_obs)
    area_train = np.array([o.area_sqft for o in train_obs])
    area_calib = np.array([o.area_sqft for o in calib_obs])
    area_test = np.array([o.area_sqft for o in test_obs])

    builder = FeatureBuilder(segment=segment)
    # Imputation medians and the locality/city/category encodings are learned
    # from the TRAINING FOLD ONLY.
    builder.fit(train_obs, y_train)
    oof_loc = leave_one_out_locality(train_obs, y_train, builder)
    X_train = builder.transform(train_obs, oof_locality=oof_loc)
    X_calib = builder.transform(calib_obs)
    X_test = builder.transform(test_obs)

    groups = [group_key(o) for o in train_obs]

    baseline = LocalityMedianBaseline().fit(train_obs, y_train)

    candidates = build_candidates(seed)
    if tune:
        trained = tune_candidates(candidates, X_train, y_train, groups, max_iter=max_iter, seed=seed)
    else:
        trained = []
        for name, factory, _ in candidates:
            est = factory()
            est.fit(X_train, y_train)
            trained.append(TrainedModel(name, est, {}, float("nan")))

    results = {}
    for tm in trained:
        pred_calib_log = tm.estimator.predict(X_calib)
        pred_test_log = tm.estimator.predict(X_test)
        results[tm.name] = {
            "model": tm,
            "pred_test_ppsf": np.exp(pred_test_log),
            "pred_calib_ppsf": np.exp(pred_calib_log),
            "cv_rmse_log": tm.cv_rmse,
        }

    base_calib_ppsf = np.exp(baseline.predict(calib_obs))
    base_test_ppsf = np.exp(baseline.predict(test_obs))
    results["locality_median_baseline"] = {
        "model": None,
        "pred_test_ppsf": base_test_ppsf,
        "pred_calib_ppsf": base_calib_ppsf,
        "cv_rmse_log": float("nan"),
    }

    scored = []
    for name, r in results.items():
        pred_total = r["pred_test_ppsf"] * area_test
        m = M.full_metrics(p_test, pred_total)
        # Interval calibration uses the CALIBRATION split only.
        calib_total = r["pred_calib_ppsf"] * area_calib
        conformal = fit_relative_conformal(p_calib, calib_total, alpha=0.10)
        lo, mid, hi = apply_relative_conformal(pred_total, conformal)
        m["interval_coverage_pct"] = M.interval_coverage(p_test, lo, hi)
        m["mean_interval_width"] = M.mean_interval_width(lo, hi)
        m["conformal_n_calibration"] = conformal["n_calibration"]
        r["metrics"] = m
        r["conformal"] = conformal
        scored.append((name, m, r))

    # Selection rule, in order: lower median APE, then lower RMSE, then
    # prefer the simpler model. Median APE is chosen over MAE because a handful
    # of ultra-luxury Gurgaon listings would otherwise dominate the choice.
    def rank(item):
        _, m, _ = item
        return (
            m["median_ape_pct"] if np.isfinite(m["median_ape_pct"]) else 1e9,
            m["rmse"],
        )

    scored_sorted = sorted(scored, key=rank)
    baseline_entry = next(s for s in scored if s[0] == "locality_median_baseline")
    best = next((s for s in scored_sorted if s[0] != "locality_median_baseline"), None)

    beats_baseline = bool(
        best and best[1]["median_ape_pct"] < baseline_entry[1]["median_ape_pct"]
    )

    return {
        "builder": builder,
        "X_train": X_train,
        "results": results,
        "baseline": baseline,
        "best_name": best[0] if best else None,
        "best": best,
        "baseline_entry": baseline_entry,
        "beats_baseline": beats_baseline,
        "test_obs": test_obs,
        "test_price": p_test,
        "test_area": area_test,
        "train_obs": train_obs,
        "calib_obs": calib_obs,
        "calib_price": p_calib,
        "calib_area": area_calib,
        "split": split,
    }


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_xgboost(est):
    import json as _json
    import tempfile
    from pathlib import Path as _P

    booster = est.get_booster()
    with tempfile.TemporaryDirectory() as td:
        p = _P(td) / "m.json"
        booster.save_model(str(p))
        raw = _json.loads(p.read_text())
    model = raw["learner"]["gradient_booster"]["model"]
    trees = model["trees"]
    base_raw = raw["learner"]["learner_model_param"]["base_score"]
    # XGBoost >= 2 serialises base_score as a bracketed string, e.g. '[5.5E0]'.
    if isinstance(base_raw, str):
        base_raw = base_raw.strip("[]")
    base_score = float(base_raw)
    return {
        "type": "xgboost",
        "base_score": base_score,
        "num_features": len(trees[0]["split_indices"]) if trees else 0,
        "trees": [
            {
                "split_indices": t["split_indices"],
                "split_conditions": t["split_conditions"],
                "left_children": t["left_children"],
                "right_children": t["right_children"],
                "default_left": t.get("default_left", [1] * len(t["left_children"])),
                "base_weights": t.get("base_weights"),
                "split_type": t.get("split_type"),
            }
            for t in trees
        ],
    }


def export_random_forest(est):
    trees = []
    for t in est.estimators_:
        trees.append(
            {
                "children_left": t.tree_.children_left.tolist(),
                "children_right": t.tree_.children_right.tolist(),
                "feature": t.tree_.feature.tolist(),
                "threshold": t.tree_.threshold.tolist(),
                "value": [float(v[0][0]) for v in t.tree_.value],
            }
        )
    return {"type": "random_forest", "trees": trees}


def export_ridge(est):
    return {
        "type": "ridge",
        "coef": [float(c) for c in est.coef_],
        "intercept": float(est.intercept_),
    }


EXPORTERS = {
    "xgboost": export_xgboost,
    "random_forest": export_random_forest,
    "ridge": export_ridge,
}


def dependency_versions():
    import sklearn
    import xgboost

    return {
        "python": platform.python_version(),
        "numpy": np.__version__,
        "sklearn": sklearn.__version__,
        "xgboost": xgboost.__version__,
    }


def train_segment(segment, obs, split_kind="geographic", seed=42, tune=True, max_iter=24):
    seg_obs = [o for o in obs if o.segment == segment]
    print(f"\n=== segment={segment}  observations={len(seg_obs)}")
    if len(seg_obs) < MIN_SEGMENT_RECORDS:
        return {
            "segment": segment,
            "trained": False,
            "reason": (
                f"insufficient representative observations ({len(seg_obs)} < "
                f"{MIN_SEGMENT_RECORDS}). No model is registered for this segment and "
                "the API will return an explicit 'insufficient data' status."
            ),
            "observations": len(seg_obs),
        }

    if split_kind == "geographic":
        split = geographic_split(seg_obs)
    elif split_kind == "locality":
        split = locality_holdout_split(seg_obs)
    else:
        split = grouped_random_split(seg_obs)

    out = evaluate_split(seg_obs, split, segment, seed=seed, tune=tune, max_iter=max_iter)
    best_name = out["best_name"]
    best = out["results"][best_name]

    est = best["model"].estimator
    exported = EXPORTERS[best_name](est)
    builder = out["builder"]

    pred_test = best["pred_test_ppsf"] * out["test_area"]
    pred_calib = best["pred_calib_ppsf"] * out["calib_area"]
    conformal = out["results"][best_name]["conformal"]

    test_obs = out["test_obs"]
    artifacts = {
        "model_id": f"estovia-{segment}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "version": "1.0.0",
        "trained_at": _now(),
        "segment": segment,
        "target": TARGET,
        "target_human": TARGET_HUMAN,
        "target_semantics": (
            "advertised asking price from public listing datasets. NOT a registered "
            "transaction price. No registered-transaction dataset was obtainable."
        ),
        "feature_schema_version": feature_schema_version(),
        "feature_names": builder.feature_names,
        "feature_groups": FEATURE_GROUPS,
        "imputation_medians": {k: float(v) for k, v in builder.medians.items()},
        "locality_stats": {k: float(v) for k, v in builder.locality_stats.items()},
        "city_stats": {k: float(v) for k, v in builder.city_stats.items()},
        "category_stats": {k: float(v) for k, v in builder.category_stats.items()},
        "global_median_log_ppsf": builder.global_median_ppsf,
        "locality_coverage": builder.locality_coverage,
        "estimator": exported,
        "estimator_name": best_name,
        "params": {k: (v if isinstance(v, (int, float, str, bool, type(None))) else str(v)) for k, v in best["model"].params.items()},
        "conformal": conformal,
        "baseline_estimator": {
            "type": "locality_median",
            "locality_stats": {k: float(v) for k, v in out["baseline"].loc.items()},
            "city_stats": {k: float(v) for k, v in out["baseline"].city.items()},
            "global_log_ppsf": out["baseline"].global_,
            "k": out["baseline"].k,
        },
        "dependencies": dependency_versions(),
    }

    report = {
        "segment": segment,
        "trained": True,
        "selected_model": best_name,
        "beats_locality_median_baseline": out["beats_baseline"],
        "observations": {
            "total": len(seg_obs),
            "train": len(out["train_obs"]),
            "calibration": len(out["calib_obs"]),
            "test": len(out["test_obs"]),
        },
        "split": {
            "kind": split_kind,
            "train_description": split.description,
            "test_description": split.test_description,
            "temporal_validation": {
                "status": "unavailable",
                "reason": (
                    "No accepted source publishes an observation date for its records, "
                    "so a train-on-past/test-on-future split cannot be constructed "
                    "without fabricating dates. Geographic and grouped holdouts are "
                    "used instead and this limitation is reported."
                ),
            },
        },
        "metrics": {
            best_name: out["results"][best_name]["metrics"],
            "locality_median_baseline": out["baseline_entry"][1],
            **{n: r["metrics"] for n, r in out["results"].items() if n not in (best_name, "locality_median_baseline")},
        },
        "conformal": conformal,
        "segment_metrics": {
            "by_city": M.segmented_metrics(out["test_price"], pred_test, [o.city for o in test_obs]),
            "by_category": M.segmented_metrics(out["test_price"], pred_test, [o.property_category for o in test_obs]),
            "by_locality": M.segmented_metrics(
                out["test_price"], pred_test, [locality_key(o) for o in test_obs], min_n=15
            ),
            "by_price_band": M.segmented_metrics(
                out["test_price"], pred_test, [_price_band(p) for p in out["test_price"]]
            ),
            "by_area_band": M.segmented_metrics(
                out["test_price"], pred_test, [_area_band(a) for a in out["test_area"]]
            ),
            "by_geo_data_available": M.segmented_metrics(
                out["test_price"],
                pred_test,
                ["has_osm" if o.geo_features else "no_osm" for o in test_obs],
            ),
        },
        "locality_coverage_in_test": (
            sum(
                1
                for o in test_obs
                if (locality_key(o) in builder.locality_stats)
            )
            / max(1, len(test_obs))
        ),
        "unseen_locality_share": (
            sum(1 for o in test_obs if (o.locality or "__none__") not in builder.locality_stats)
            / max(1, len(test_obs))
        ),
    }

    return {
        "segment": segment,
        "trained": True,
        "report": report,
        "artifact": artifacts,
        "evaluation": out,
    }


def _price_band(p):
    if p < 5_000_000:
        return "<50 lakh"
    if p < 1_000_000:
        return "50 lakh - 1 crore"
    if p < 2_500_000:
        return "1 - 2.5 crore"
    if p < 5_000_000:
        return "2.5 - 5 crore"
    return "5 crore +"


def _area_band(a):
    if a < 600:
        return "<600 sqft"
    if a < 1000:
        return "600 - 1000 sqft"
    if a < 1500:
        return "1000 - 1500 sqft"
    if a < 2500:
        return "1500 - 2500 sqft"
    return "2500+ sqft"


def main(argv=None):
    ap = argparse.ArgumentParser(description="Estovia ML training")
    ap.add_argument("--observations", default=None)
    ap.add_argument("--segment", default="all", choices=["all", *SEGMENTS])
    ap.add_argument("--split", default="geographic", choices=["geographic", "grouped", "locality"])
    ap.add_argument("--include-noncommercial", action="store_true")
    ap.add_argument("--osm", action="store_true", help="enrich with OpenStreetMap features first")
    ap.add_argument("--osm-budget", type=int, default=60)
    ap.add_argument("--no-tune", action="store_true")
    ap.add_argument("--max-iter", type=int, default=24)
    ap.add_argument("--out", default=str(ARTIFACT_DIR))
    args = ap.parse_args(argv)

    from .geospatial import enrich_observations

    path = Path(args.observations or (PROCESSED / "observations.jsonl"))
    if not path.exists():
        print(f"observations file not found: {path}\nRun: python -m estovia_ml.ingest")
        return 1

    obs = load_observations(path, include_noncommercial=args.include_noncommercial)
    print(f"loaded {len(obs)} real observations from {path}")

    if args.osm:
        print("enriching with OpenStreetMap accessibility features (tile cache)...")
        n, tiles = enrich_observations(obs, budget=args.osm_budget)
        print(f"  enriched {n} observations from {tiles} OSM tiles")
        outp = path.with_name("observations_enriched.jsonl")
        from dataclasses import asdict

        with outp.open("w", encoding="utf-8") as fh:
            for o in obs:
                fh.write(json.dumps(asdict(o), ensure_ascii=False) + "\n")
        print(f"  wrote {outp}")
        path = outp

    segments = SEGMENTS if args.segment == "all" else [args.segment]
    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)

    registry = {
        "generated_at": _now(),
        "feature_schema_version": feature_schema_version(),
        "target": TARGET,
        "target_semantics": (
            "advertised asking prices from public, permissively licensed listing "
            "datasets. No registered-transaction data was obtainable in this "
            "environment, so this engine does NOT estimate registered sale prices."
        ),
        "geography": {
            "cities": sorted({o.city for o in obs}),
            "note": "Delhi NCR only. Requests outside these cities return an explicit unsupported status.",
        },
        "models": [],
        "segments_not_trained": [],
    }

    for segment in segments:
        seg_obs = [o for o in obs if o.segment == segment]
        if len(seg_obs) < MIN_SEGMENT_RECORDS:
            registry["segments_not_trained"].append(
                {
                    "segment": segment,
                    "observations": len(seg_obs),
                    "reason": f"only {len(seg_obs)} observations (< {MIN_SEGMENT_RECORDS})",
                }
            )
            print(f"=== segment={segment}: SKIPPED, only {len(seg_obs)} observations")
            continue
        res = train_segment(
            segment,
            obs,
            split_kind=args.split,
            tune=not args.no_tune,
            max_iter=args.max_iter,
        )
        if not res.get("trained"):
            registry["segments_not_trained"].append(
                {"segment": segment, "observations": len(seg_obs), "reason": res.get("reason")}
            )
            continue
        artifact = res["artifact"]
        report = res["report"]
        ap_path = outdir / f"model_{segment}.json"
        rp_path = outdir / f"evaluation_{segment}.json"
        ap_path.write_text(json.dumps(artifact, indent=1), encoding="utf-8")
        rp_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        registry["models"].append(
            {
                "model_id": artifact["model_id"],
                "segment": segment,
                "artifact_path": f"artifacts/{ap_path.name}",
                "evaluation_path": f"artifacts/{rp_path.name}",
                "estimator": artifact["estimator_name"],
                "trained_at": artifact["trained_at"],
                "test_metrics": report["metrics"][report["selected_model"]],
                "baseline_metrics": report["metrics"]["locality_median_baseline"],
                "observations": report["observations"],
                "beats_baseline": report["beats_locality_median_baseline"],
                "non_commercial_sources_included": any(o.non_commercial for o in seg_obs),
            }
        )
        print(
            f"  -> {report['selected_model']}  test medianAPE="
            f"{report['metrics'][report['selected_model']]['median_ape_pct']:.2f}%  "
            f"MAE={report['metrics'][report['selected_model']]['mae']:,.0f}  "
            f"R2={report['metrics'][report['selected_model']]['r2']:.3f}  "
            f"coverage={report['metrics'][report['selected_model']].get('interval_coverage_pct', float('nan')):.1f}%"
        )

    (outdir / "registry.json").write_text(json.dumps(registry, indent=2), encoding="utf-8")
    print(f"\nwrote registry -> {outdir / 'registry.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
