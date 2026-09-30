"""Cross-language parity check: Python reference vs the JavaScript evaluator.

The application evaluates the exported trees in JavaScript
(`src/lib/valuation/model.js`). If those two implementations ever disagree, the
UI would quietly show different numbers from the evaluation report, which
would make every published metric meaningless.

This script runs both on the same real observations and fails loudly on any
mismatch. It is the gate that must pass before a model is promoted.

    python -m scripts.verify_js_parity --segment builtup --sample 300
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path(__file__).resolve().parents[2] / "src" / "lib" / "valuation" / "artifacts"
REL_TOLERANCE = 1e-5


def python_reference(art, X):
    from estovia_ml.verify_parity import PREDICTORS

    return np.asarray(PREDICTORS[art["estimator_name"]](art, X), dtype=np.float64)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Verify Python and JavaScript evaluators agree")
    ap.add_argument("--segment", default="builtup")
    ap.add_argument("--sample", type=int, default=300)
    ap.add_argument("--tolerance", type=float, default=REL_TOLERANCE)
    args = ap.parse_args(argv)

    sys.path.insert(0, str(ROOT))
    from estovia_ml.features import FeatureBuilder
    from estovia_ml.train import load_observations

    bin_path = OUT_DIR / f"model_{args.segment}.bin"
    if not bin_path.exists():
        print(f"no runtime artefact at {bin_path}; run export_runtime_model.py first", file=sys.stderr)
        return 1

    art = json.loads((ROOT / "artifacts" / f"model_{args.segment}.json").read_text(encoding="utf-8"))

    obs = load_observations(segment=args.segment, include_noncommercial=True)
    if not obs:
        print("no observations available", file=sys.stderr)
        return 1
    rng = np.random.default_rng(11)
    idx = rng.permutation(len(obs))[: args.sample]
    sub = [obs[i] for i in idx]

    builder = FeatureBuilder(segment=args.segment)
    builder.medians = art["imputation_medians"]
    builder.locality_stats = art["locality_stats"]
    builder.city_stats = art["city_stats"]
    builder.category_stats = art["category_stats"]
    builder.global_median_ppsf = art["global_median_log_ppsf"]
    builder.locality_freq = {}
    builder.feature_names = art["feature_names"]
    X = builder.transform(sub)

    y_true = np.log(np.array([o.price_per_sqft_inr for o in sub]))
    y_ref = python_reference(art, X)

    payload = {
        "featureNames": art["feature_names"],
        "rows": [[float(v) for v in row] for row in X],
    }
    with tempfile.TemporaryDirectory() as td:
        payload_path = Path(td) / "rows.json"
        payload_path.write_text(json.dumps(payload), encoding="utf-8")
        module_url = (OUT_DIR.parent / "model.js").as_uri()
        script = Path(td) / "predict.mjs"
        script.write_text(
            "import fs from 'fs';\n"
            f"import {{ getModel, predictTree }} from '{module_url}';\n"
            "const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));\n"
            "const model = getModel(process.argv[3]);\n"
            "if (!model.available) { console.error('model unavailable'); process.exit(2); }\n"
            "const out = payload.rows.map((row) => predictTree(model, row));\n"
            "process.stdout.write(JSON.stringify(out));\n",
            encoding="utf-8",
        )
        # Run from the repository root so the module's artefact-dir resolution
        # behaves exactly as it does under `next dev`.
        result = subprocess.run(
            ["node", str(script), str(payload_path), args.segment],
            capture_output=True,
            text=True,
            cwd=str(ROOT.parent),
        )
    if result.returncode != 0:
        print("node evaluator failed:\n" + result.stderr, file=sys.stderr)
        return 1
    y_js = np.asarray(json.loads(result.stdout), dtype=np.float64)

    if y_js.shape != y_ref.shape:
        print(f"shape mismatch: js={y_js.shape} ref={y_ref.shape}", file=sys.stderr)
        return 1

    abs_diff = np.abs(y_js - y_ref)
    denom = np.maximum(np.abs(y_ref), 1e-9)
    rel_diff = abs_diff / denom
    worst = int(np.argmax(rel_diff))

    ok = rel_diff.max() <= args.tolerance
    print(f"rows={len(sub)}  max_abs_diff={abs_diff.max():.3e}  max_rel_diff={rel_diff.max():.3e}")
    print(f"worst row: ref={y_ref[worst]:.6f}  js={y_js[worst]:.6f}")

    if not ok:
        print(
            f"PARITY FAILED: relative difference {rel_diff.max():.3e} exceeds {args.tolerance:.0e}. "
            "The JavaScript evaluator does not reproduce the Python model.",
            file=sys.stderr,
        )
        return 1

    from estovia_ml import metrics as M

    ppsf_ref = np.exp(y_ref)
    ppsf_js = np.exp(y_js)
    truth = np.array([o.price_inr for o in sub])
    area = np.array([o.area_sqft for o in sub])
    m_ref = M.full_metrics(truth, ppsf_ref * area)
    m_js = M.full_metrics(truth, ppsf_js * area)
    print(
        f"python: medianAPE={m_ref['median_ape_pct']:.4f}%  MAE={m_ref['mae']:.2f}  R2={m_ref['r2']:.6f}"
    )
    print(
        f"node  : medianAPE={m_js['median_ape_pct']:.4f}%  MAE={m_js['mae']:.2f}  R2={m_js['r2']:.6f}"
    )
    print(f"PARITY OK ({args.segment}, model {art['model_id']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
