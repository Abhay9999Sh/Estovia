"""Prove the JavaScript feature transform matches the Python trainer.

`verify_js_parity.py` checks the tree walk. This checks the thing in front of
it: the 46-column feature matrix. If `src/lib/valuation/features.js` and
`estovia_ml/features.py` disagree about even one column, the trees still
evaluate cleanly and the app still returns a confident wrong number, so the only
way to catch it is to diff the vectors.

Real observations are pushed through BOTH paths:

    Python  : observations.jsonl -> FeatureBuilder.transform  -> vector
    Node    : same rows            -> normalizeInput + buildFeatureVector -> vector

Node routes through `schema.js` as well, so this covers validation, unit
conversion and the feature build in one comparison.

    python -m scripts.verify_js_features --segment builtup --sample 500
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

# `np.log` and `Math.log` are not required to agree to the last bit, and a
# feature like log_area_sqft sits around 7, where one ULP is ~1e-15. Anything
# below a few ULPs is noise; the tree-walk parity test in verify_js_parity.py
# is what proves the predictions themselves are identical.
ABS_TOL = 1e-9
REL_TOL = 1e-12


def close(a: float, b: float) -> bool:
    return abs(a - b) <= max(ABS_TOL, REL_TOL * max(abs(a), abs(b), 1.0))


def build_cases(segment: str, sample: int | None):
    """Python-side vectors plus the raw fields the JS side needs."""
    sys.path.insert(0, str(ROOT))
    from estovia_ml.features import FeatureBuilder
    from estovia_ml.train import load_observations

    art = json.loads((ROOT / "artifacts" / f"model_{segment}.json").read_text(encoding="utf-8"))
    meta = json.loads((OUT_DIR / f"model_{segment}.meta.json").read_text(encoding="utf-8"))

    obs = load_observations(segment=segment)
    if sample:
        # Deterministic stride rather than a random draw, so a failure is
        # reproducible from the command line alone.
        step = max(1, len(obs) // sample)
        obs = obs[::step][:sample]

    builder = FeatureBuilder(segment=segment)
    builder.medians = art["imputation_medians"]
    builder.locality_stats = art["locality_stats"]
    builder.city_stats = art["city_stats"]
    builder.category_stats = art["category_stats"]
    builder.global_median_ppsf = art["global_median_log_ppsf"]
    builder.locality_freq = meta.get("localityFreq", {})
    builder.feature_names = art["feature_names"]

    matrix = builder.transform(obs)

    cases = []
    for o, row in zip(obs, matrix):
        cases.append(
            {
                "input": {
                    "areaSqFt": o.area_sqft,
                    "areaUnit": "sqft",
                    "areaDefinition": o.area_definition,
                    "bedrooms": o.bedrooms,
                    "bathrooms": o.bathrooms,
                    "balconies": o.balconies,
                    "floorNumber": o.floor_number,
                    "totalFloors": o.total_floors,
                    "propertyAgeYears": o.property_age_years,
                    "liftAvailable": o.lift_available,
                    "parkingCount": o.parking_count,
                    "amenities": list(o.amenities or []),
                    "amenityFlags": dict(o.amenity_flags or {}) or None,
                    "facing": o.facing,
                    "furnishing": o.furnishing,
                    "ownership": o.ownership,
                    "transactionType": o.transaction_type,
                    "city": o.city,
                    "locality": o.locality,
                    "latitude": o.latitude,
                    "longitude": o.longitude,
                    "propertyCategory": o.property_category,
                },
                "expected": [float(v) for v in row],
            }
        )
    return art["feature_names"], cases


def main(argv=None):
    ap = argparse.ArgumentParser(description="Diff JS and Python feature vectors")
    ap.add_argument("--segment", default="builtup")
    ap.add_argument("--sample", type=int, default=500)
    args = ap.parse_args(argv)

    feature_names, cases = build_cases(args.segment, args.sample)
    print(f"segment={args.segment}  rows={len(cases)}  features={len(feature_names)}")

    with tempfile.TemporaryDirectory() as td:
        payload = Path(td) / "cases.json"
        payload.write_text(
            json.dumps({"featureNames": feature_names, "cases": cases}), encoding="utf-8"
        )
        module_url = (OUT_DIR.parent / "schema.js").resolve().as_uri()
        features_url = (OUT_DIR.parent / "features.js").resolve().as_uri()
        model_url = (OUT_DIR.parent / "model.js").resolve().as_uri()
        script = Path(td) / "build.mjs"
        script.write_text(
            "import fs from 'fs';\n"
            f"import {{ normalizeInput }} from '{module_url}';\n"
            f"import {{ buildFeatureVector }} from '{features_url}';\n"
            f"import {{ getModel }} from '{model_url}';\n"
            "const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));\n"
            f"const model = getModel(process.argv[3]);\n"
            "if (!model.available) { console.error('model unavailable'); process.exit(2); }\n"
            "const out = [];\n"
            "for (const c of payload.cases) {\n"
            "  try { out.push({ ok: true, v: buildFeatureVector(normalizeInput(c.input), model) }); }\n"
            "  catch (e) { out.push({ ok: false, error: String(e && e.message || e) }); }\n"
            "}\n"
            "process.stdout.write(JSON.stringify(out));\n",
            encoding="utf-8",
        )
        result = subprocess.run(
            ["node", str(script), str(payload), args.segment],
            capture_output=True,
            text=True,
            cwd=str(ROOT.parent),
        )
    if result.returncode != 0:
        print("node feature build failed:\n" + result.stderr, file=sys.stderr)
        return 1

    actual = json.loads(result.stdout)

    compared = 0
    skipped = 0
    skip_reasons: dict[str, int] = {}
    worst = {"diff": 0.0, "feature": None, "row": None}
    per_feature: dict[str, float] = {}
    # feature -> first (python, js) pair that disagreed, for diagnosis.
    per_feature_example: dict[str, tuple] = {}

    for i, (case, got) in enumerate(zip(cases, actual)):
        if not got.get("ok"):
            skipped += 1
            reason = got.get("error", "unknown")
            skip_reasons[reason] = skip_reasons.get(reason, 0) + 1
            continue
        compared += 1
        expected = np.asarray(case["expected"], dtype=np.float64)
        vector = np.asarray(got["v"], dtype=np.float64)
        diffs = np.abs(vector - expected)
        for name, d, e, g in zip(feature_names, diffs, expected, vector):
            if d > per_feature.get(name, 0.0):
                per_feature[name] = float(d)
            if not close(float(e), float(g)) and name not in per_feature_example:
                per_feature_example[name] = (float(e), float(g), i)
        j = int(np.argmax(diffs))
        if float(diffs[j]) > worst["diff"]:
            worst = {
                "diff": float(diffs[j]),
                "feature": feature_names[j],
                "row": i,
                "expected": float(expected[j]),
                "got": float(vector[j]),
            }

    print(f"\ncompared {compared} rows, skipped {skipped}")
    if skipped:
        for reason, n in sorted(skip_reasons.items(), key=lambda kv: -kv[1]):
            print(f"  skipped {n:>4}  {reason}")

    print(
        f"\nmax abs diff = {worst['diff']:.3e}  "
        f"(tolerance {ABS_TOL:.0e} abs / {REL_TOL:.0e} rel)"
    )
    if worst["feature"]:
        print(
            f"worst feature: {worst['feature']} on row {worst['row']}  "
            f"python={worst['expected']!r} js={worst['got']!r}"
        )
    mismatched = {k: v for k, v in per_feature.items() if v > ABS_TOL}
    if mismatched:
        print("\ndisagreeing features (python vs js on the first offending row):")
        for name, d in sorted(mismatched.items(), key=lambda kv: -kv[1]):
            e, g, r = per_feature_example[name]
            print(
                f"  {name:<26} max={d:.3e}  python={e!r}  js={g!r}  (row {r})"
            )
            print(f"      raw input: {json.dumps(cases[r]['input'], default=str)}")
    top = sorted(per_feature.items(), key=lambda kv: -kv[1])[:5]
    if top:
        print("\nlargest per-feature differences (including float noise):")
        for name, d in top:
            print(f"  {name:<26} {d:.3e}")

    if compared < max(1, len(cases) // 2):
        print(
            f"\nFAIL: only {compared} of {len(cases)} rows were comparable, so this "
            f"proves little. Raise --sample or fix the validation layer.",
            file=sys.stderr,
        )
        return 1

    if not close(worst["expected"], worst["got"]):
        print(
            f"\nFEATURE MISMATCH: JavaScript and Python disagree by "
            f"{worst['diff']:.3e} on `{worst['feature']}`. Do not ship this.",
            file=sys.stderr,
        )
        return 1

    print(
        f"\nFEATURE PARITY OK: {compared} rows agree with the Python trainer on all "
        f"{len(feature_names)} features to within {ABS_TOL:.0e} absolute / {REL_TOL:.0e} relative."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
