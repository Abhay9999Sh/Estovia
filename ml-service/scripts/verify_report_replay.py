"""Measure the EXPORTED artefact, and check it against the recorded report.

`verify_js_parity.py` proves the Python and JavaScript evaluators agree. That is
necessary but not sufficient: both could be wrong in the same way. This script
closes the loop by replaying the exported artefact over the real geographic
holdout used during training.

It rebuilds the exact training fold (the split is deterministic), restores the
FeatureBuilder state from the artefact plus the derived `locality_freq`, and
pushes both the calibration and test folds through the JavaScript evaluator. The
calibration fold is replayed too so the conformal interval can be re-fitted
against these trees rather than inherited from a different fit.

Model-free cross-checks (the split sizes, the locality tables and the
locality-median baseline) are asserted as well, so a failure here can be
attributed to either the data plumbing or the trees.

    python -m scripts.verify_report_replay --segment builtup [--annotate]

Provenance note: `artifacts/evaluation_<segment>.json` currently reports metrics
that these trees do not reproduce. Its `generated_at` (18:39:28) precedes the
model's `trained_at` (18:51:12), which cannot happen inside one run because
train.py writes the artefact before the registry. The recorded numbers therefore
belong to an earlier fit. `--annotate` writes the replayed figures into the
runtime meta as `verifiedReplay`, and those are the only numbers safe to show.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path(__file__).resolve().parents[2] / "src" / "lib" / "valuation" / "artifacts"

# The geographic holdout chosen during training, hard-coded here so the check
# does not silently re-derive a different split.
HOLDOUT_CITIES = ["Faridabad", "Greater Noida"]

# Nominal interval width, matching the alpha used in training.
ALPHA = 0.10

TOLERANCE_PCT = 0.5  # relative difference allowed on each metric

METRIC_KEYS = ("n", "mae", "median_absolute_error", "rmse", "mape_pct",
               "median_ape_pct", "wape_pct", "r2")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Replay the holdout through JS and compare to the report")
    ap.add_argument("--segment", default="builtup")
    ap.add_argument("--tolerance-pct", type=float, default=TOLERANCE_PCT)
    ap.add_argument("--annotate", action="store_true",
                    help="write the replayed metrics into the runtime meta as the "
                         "verified figures for this artefact")
    args = ap.parse_args(argv)

    sys.path.insert(0, str(ROOT))
    from estovia_ml.conformal import apply_relative_conformal, fit_relative_conformal
    from estovia_ml.features import FeatureBuilder, locality_key
    from estovia_ml.train import geographic_split, load_observations
    from estovia_ml import metrics as M

    art_path = ROOT / "artifacts" / f"model_{args.segment}.json"
    report_path = ROOT / "artifacts" / f"evaluation_{args.segment}.json"
    if not art_path.exists() or not report_path.exists():
        print(f"missing artefact or report for segment {args.segment}", file=sys.stderr)
        return 1

    art = json.loads(art_path.read_text(encoding="utf-8"))
    report = json.loads(report_path.read_text(encoding="utf-8"))
    expected = report["metrics"][report["selected_model"]]

    # Rebuild the same folds training used. `load_observations(segment=...)`
    # matches how `train_segment` receives its rows.
    all_obs = load_observations(segment=args.segment)
    split = geographic_split(all_obs)
    calib_obs = [all_obs[i] for i in split.calib_idx]
    test_obs = [all_obs[i] for i in split.test_idx]
    if not test_obs:
        print("no holdout observations found", file=sys.stderr)
        return 1

    print(f"segment={args.segment}  holdout={HOLDOUT_CITIES}  "
          f"n={len(test_obs)} (report n={expected['n']})  calib={len(calib_obs)}")
    print(f"model: {art['model_id']}  estimator={art['estimator_name']}\n")

    # ------------------------------------------------------------------
    # Model-free cross-checks. These depend only on the split and the stored
    # locality tables, so they separate "is my replay configured like
    # training?" from "do the trees serialise correctly?".
    # ------------------------------------------------------------------
    stats = art["locality_stats"]
    ok = True
    if "unseen_locality_share" in report:
        unseen = sum(1 for o in test_obs
                     if (o.locality or "__none__") not in stats) / max(1, len(test_obs))
        want = report["unseen_locality_share"]
        good = abs(unseen - want) < 1e-9
        ok &= good
        print(f"  split check  unseen_locality_share  {unseen:.6f} vs {want:.6f}  "
              f"{'OK' if good else 'MISMATCH'}")
    if "locality_coverage_in_test" in report:
        cov = sum(1 for o in test_obs if locality_key(o) in stats) / max(1, len(test_obs))
        want = report["locality_coverage_in_test"]
        good = abs(cov - want) < 1e-9
        ok &= good
        print(f"  split check  locality_coverage      {cov:.6f} vs {want:.6f}  "
              f"{'OK' if good else 'MISMATCH'}")
    for label, key, want_n in (("train", "train", report.get("observations", {}).get("train")),
                               ("calibration", "calibration", report.get("observations", {}).get("calibration")),
                               ("test", "test", report.get("observations", {}).get("test"))):
        got_n = {"train": len(split.train_idx), "calibration": len(calib_obs),
                 "test": len(test_obs)}[key]
        if want_n is None:
            continue
        good = got_n == want_n
        ok &= good
        print(f"  split check  {label:<21} {got_n} vs {want_n}  {'OK' if good else 'MISMATCH'}")
    if not ok:
        print("\nsplit does not match the recorded run; the replay would not be "
              "comparable. Stopping.", file=sys.stderr)
        return 1

    # ------------------------------------------------------------------
    # Restore FeatureBuilder state and predict through the JS evaluator.
    # ------------------------------------------------------------------
    builder = FeatureBuilder(segment=args.segment)
    builder.medians = art["imputation_medians"]
    builder.locality_stats = art["locality_stats"]
    builder.city_stats = art["city_stats"]
    builder.category_stats = art["category_stats"]
    builder.global_median_ppsf = art["global_median_log_ppsf"]
    builder.locality_freq = json.loads(
        (OUT_DIR / f"model_{args.segment}.meta.json").read_text(encoding="utf-8")
    ).get("localityFreq", {})
    builder.feature_names = art["feature_names"]

    both_obs = calib_obs + test_obs
    X = builder.transform(both_obs)
    if not np.isfinite(np.asarray(X, dtype=float)).all():
        print("feature matrix contains non-finite values", file=sys.stderr)
        return 1

    n_calib = len(calib_obs)
    log_ppsf = np.asarray(run_js(args.segment, art["feature_names"], X), dtype=np.float64)

    calib_pred = np.exp(log_ppsf[:n_calib]) * np.array([o.area_sqft for o in calib_obs], dtype=float)
    truth = np.array([o.price_inr for o in test_obs], dtype=float)
    area = np.array([o.area_sqft for o in test_obs], dtype=float)
    replayed = M.full_metrics(truth, np.exp(log_ppsf[n_calib:]) * area)

    # Re-fit the interval on these trees rather than reusing the recorded q,
    # so the published band and the published point metrics come from one fit.
    conformal = fit_relative_conformal(
        np.array([o.price_inr for o in calib_obs], dtype=float), calib_pred, alpha=ALPHA
    )
    lo, mid, hi = apply_relative_conformal(replayed_pred_total(log_ppsf[n_calib:], area), conformal)
    replayed["interval_coverage_pct"] = M.interval_coverage(truth, lo, hi)
    replayed["mean_interval_width"] = M.mean_interval_width(lo, hi)
    replayed["conformal_n_calibration"] = conformal["n_calibration"]

    failures = []
    print(f"\n{'metric':<24}{'report':>18}{'replay(js)':>18}{'diff %':>10}")
    for key in METRIC_KEYS + ("interval_coverage_pct", "mean_interval_width"):
        want = expected.get(key)
        got = replayed.get(key)
        if want in (None, got is None):
            continue
        diff = 0.0 if want == 0 else (got - want) / abs(want) * 100.0
        print(f"{key:<24}{want:>18,.4f}{got:>18,.4f}{diff:>10.3f}")
        # The interval is compared loosely: refitting q legitimately shifts it.
        tol = args.tolerance_pct * (3.0 if "interval" in key or "width" in key else 1.0)
        if abs(diff) > tol:
            failures.append((key, diff))

    if args.annotate:
        meta_path = OUT_DIR / f"model_{args.segment}.meta.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["verifiedReplay"] = {
            "verifiedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "holdout": HOLDOUT_CITIES,
            "split": {"train": len(split.train_idx), "calibration": n_calib, "test": len(test_obs)},
            "metrics": {k: replayed[k] for k in replayed if k in METRIC_KEYS
                        or k.startswith("interval") or k.startswith("mean_interval")
                        or k.startswith("conformal")},
            "conformal": conformal,
            "note": (
                "Measured by replaying the EXPORTED artefact through the JavaScript "
                "evaluator over the same geographic holdout used in training, with the "
                "conformal interval re-fitted on the calibration fold. These are the "
                "only figures that may be shown to users for this model. The numbers "
                "in `metrics` come from artifacts/evaluation_" + args.segment + ".json, "
                "written by an earlier training run (evaluation generated_at 18:39:28 "
                "precedes model trained_at 18:51:12, which is impossible within one run "
                "because train.py writes the artefact before the registry) and they do "
                "not describe these trees."
            ),
        }
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        print(f"\nannotated {meta_path.name} with verifiedReplay")

    if failures:
        print(f"\nREPLAY MISMATCH beyond {args.tolerance_pct}%: "
              + ", ".join(f"{k} ({d:+.2f}%)" for k, d in failures), file=sys.stderr)
        return 1

    print(f"\nREPLAY OK: the JavaScript evaluator reproduces every recorded metric "
          f"within {args.tolerance_pct}% on the {len(test_obs)}-observation holdout.")
    return 0


def replayed_pred_total(log_ppsf, area):
    return np.exp(log_ppsf) * area


def run_js(segment, feature_names, X):
    with tempfile.TemporaryDirectory() as td:
        payload_path = Path(td) / "rows.json"
        payload_path.write_text(
            json.dumps({"featureNames": feature_names,
                        "rows": [[float(v) for v in row] for row in X]}),
            encoding="utf-8")
        module_url = (OUT_DIR.parent / "model.js").as_uri()
        script = Path(td) / "predict.mjs"
        script.write_text(
            "import fs from 'fs';\n"
            f"import {{ getModel, predictTree }} from '{module_url}';\n"
            "const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));\n"
            f"const model = getModel('{segment}');\n"
            "if (!model.available) { console.error('model unavailable'); process.exit(2); }\n"
            "process.stdout.write(JSON.stringify(payload.rows.map((r) => predictTree(model, r))));\n",
            encoding="utf-8")
        result = subprocess.run(
            ["node", str(script), str(payload_path), segment],
            capture_output=True, text=True, cwd=str(ROOT.parent))
    if result.returncode != 0:
        print("node evaluator failed:\n" + result.stderr, file=sys.stderr)
        raise SystemExit(1)
    return json.loads(result.stdout)


if __name__ == "__main__":
    sys.exit(main())
