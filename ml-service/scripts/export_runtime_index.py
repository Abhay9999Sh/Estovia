"""Export the runtime artefacts the Next.js inference layer needs.

This does NOT retrain and does NOT invent anything. It reads the already
validated observation set plus the already trained model artefacts and writes
two small, bundler-friendly JSON files:

  1. registry.json      - model metadata + measured evaluation metrics, trimmed
                          to the fields the application is allowed to display.
  2. comparables.json   - real, public asking-price observations grouped into
                          (city, locality, category) buckets. Each bucket keeps
                          aggregate market statistics plus a capped sample of
                          individual observations for display as comparables.

Only public listing attributes are exported. No owner identity, contact detail,
document or internal record path is included.

    python -m scripts.export_runtime_index
    python -m scripts.export_runtime_index --max-samples-per-bucket 6
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OBS_PATH = ROOT / "data" / "processed" / "observations.jsonl"
ARTIFACTS = ROOT / "artifacts"
OUT_DIR = Path(__file__).resolve().parents[2] / "src" / "lib" / "valuation" / "artifacts"

DEFAULT_MAX_SAMPLES = 6
DEFAULT_MAX_BUCKETS = 4000


def percentile(values, q):
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return round(ordered[0], 2)
    pos = q * (len(ordered) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(ordered) - 1)
    frac = pos - lo
    return round(ordered[lo] * (1 - frac) + ordered[hi] * frac, 2)


def r2(x, nd=2):
    if x is None:
        return None
    return round(float(x), nd)


def iter_observations():
    with OBS_PATH.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def build_comparables(max_samples: int, max_buckets: int):
    buckets = defaultdict(lambda: {"ppsf": [], "total": [], "area": [], "beds": [], "samples": [], "sources": set()})

    for o in iter_observations():
        if o.get("is_demo"):
            continue
        if o.get("non_commercial"):
            continue
        ppsf = o.get("price_per_sqft_inr")
        area = o.get("area_sqft")
        if not ppsf or not area or ppsf <= 0 or area <= 0:
            continue
        city = (o.get("city") or "").strip()
        if not city:
            continue
        key = f"{city}|{(o.get('locality') or '').strip()}|{o.get('property_category')}"
        b = buckets[key]
        b["ppsf"].append(float(ppsf))
        b["total"].append(float(o.get("price_inr") or ppsf * area))
        b["area"].append(float(area))
        if o.get("bedrooms"):
            b["beds"].append(float(o["bedrooms"]))
        b["sources"].add(o.get("source_key") or "unknown")
        if len(b["samples"]) < max_samples:
            b["samples"].append(
                {
                    "areaSqFt": round(float(area), 1),
                    "bedrooms": int(o["bedrooms"]) if o.get("bedrooms") else None,
                    "priceInr": round(float(o.get("price_inr") or ppsf * area)),
                    "pricePerSqFt": round(float(ppsf)),
                    "propertyCategory": o.get("property_category"),
                    "targetType": o.get("target_type"),
                    "sourceKey": o.get("source_key"),
                    "licenseKey": o.get("license_key"),
                    "retrievedAt": (o.get("retrieved_at") or "")[:10],
                    "projectName": o.get("project_name") or o.get("builder_name") or None,
                }
            )

    ordered = sorted(buckets.items(), key=lambda kv: (-len(kv[1]["ppsf"]), kv[0]))
    kept = ordered[:max_buckets]
    dropped = len(ordered) - len(kept)

    out_buckets = []
    cities = defaultdict(lambda: {"n": 0})
    for key, b in kept:
        city, locality, category = key.split("|", 2)
        out_buckets.append(
            {
                "key": key,
                "city": city,
                "locality": locality or None,
                "propertyCategory": category,
                "n": len(b["ppsf"]),
                "medianPricePerSqFt": r2(statistics.median(b["ppsf"])),
                "p25PricePerSqFt": percentile(b["ppsf"], 0.25),
                "p75PricePerSqFt": percentile(b["ppsf"], 0.75),
                "minPricePerSqFt": r2(min(b["ppsf"])),
                "maxPricePerSqFt": r2(max(b["ppsf"])),
                "medianTotalPriceInr": r2(statistics.median(b["total"]), 0),
                "medianAreaSqFt": r2(statistics.median(b["area"]), 0),
                "medianBedrooms": r2(statistics.median(b["beds"]), 1) if b["beds"] else None,
                "sources": sorted(b["sources"]),
                "samples": b["samples"],
            }
        )

    for b in out_buckets:
        cities.setdefault(b["city"], {"n": 0})["n"] += b["n"]

    city_rollup = []
    for city, agg in sorted(cities.items(), key=lambda kv: -kv[1]["n"]):
        sub = [x for x in out_buckets if x["city"] == city]
        ppsf_all = []
        for b in sub:
            ppsf_all.extend([b["medianPricePerSqFt"]] * b["n"])
        city_rollup.append(
            {
                "city": city,
                "observations": agg["n"],
                "localities": len(sub),
                "medianPricePerSqFt": r2(statistics.median(ppsf_all)),
                "p25PricePerSqFt": percentile(ppsf_all, 0.25),
                "p75PricePerSqFt": percentile(ppsf_all, 0.75),
            }
        )

    return {
        "generated_at": None,
        "target_type": "asking_price",
        "target_note": (
            "Advertised asking prices from public, permissively licensed listing "
            "datasets. These are NOT registered sale transaction prices."
        ),
        "total_observations": sum(b["n"] for b in out_buckets),
        "buckets": len(out_buckets),
        "buckets_dropped_as_low_volume": dropped,
        "sources": sorted({s for _, b in kept for s in b["sources"]}),
        "cities": city_rollup,
        "localityBuckets": out_buckets,
    }


def build_registry(top_localities=60):
    reg = json.loads((ARTIFACTS / "registry.json").read_text(encoding="utf-8"))
    models = []
    for m in reg.get("models", []):
        ev = {}
        eval_path = ROOT / m["evaluation_path"]
        if eval_path.exists():
            ev = json.loads(eval_path.read_text(encoding="utf-8"))
        segm = ev.get("segment_metrics", {}) or {}
        by_locality = segm.get("by_locality", {}) or {}
        ranked = sorted(by_locality.items(), key=lambda kv: -kv[1].get("n", 0))
        segm = {
            "by_city": segm.get("by_city", {}),
            "by_category": segm.get("by_category", {}),
            "by_price_range": segm.get("by_price_range", {}),
            "by_locality_top": dict(ranked[:top_localities]),
            "by_locality_count": len(by_locality),
            "by_locality_insufficient_count": sum(
                1 for _, v in by_locality.items() if not v.get("sufficient")
            ),
        }

        # Prefer metrics that were re-measured against the EXPORTED trees.
        # `test_metrics` in artifacts/registry.json is whatever the training run
        # recorded, which is not necessarily the fit that produced the trees we
        # ship. `verifiedReplay` is written by verify_report_replay.py --annotate
        # and is the only set of numbers that demonstrably belongs to this
        # artefact, so it wins when present.
        test_metrics = m.get("test_metrics", {})
        provenance = "training-report"
        meta_path = OUT_DIR / f"model_{m['segment']}.meta.json"
        verified = None
        if meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            verified = meta.get("verifiedReplay")
        if verified and verified.get("metrics"):
            test_metrics = verified["metrics"]
            provenance = "verified-replay-of-exported-artefact"
            if verified.get("conformal"):
                ev = dict(ev)
                ev["conformal"] = verified["conformal"]

        models.append(
            {
                "modelId": m["model_id"],
                "segment": m["segment"],
                "estimator": m["estimator"],
                "trainedAt": m["trained_at"],
                "artifactPath": m["artifact_path"],
                "evaluationPath": m["evaluation_path"],
                "testMetrics": test_metrics,
                "testMetricsProvenance": provenance,
                "verifiedAt": (verified or {}).get("verifiedAt"),
                "baselineMetrics": m.get("baseline_metrics", {}),
                "observations": m.get("observations", {}),
                "beatsBaseline": m.get("beats_baseline", False),
                "nonCommercialSourcesIncluded": m.get("non_commercial_sources_included", False),
                "selectedModel": ev.get("selected_model"),
                "split": ev.get("split", {}),
                "conformal": ev.get("conformal", {}),
                "segmentMetrics": segm,
                "allCandidates": {
                    k: {"mape_pct": v.get("mape_pct"), "r2": v.get("r2"), "wape_pct": v.get("wape_pct")}
                    for k, v in (ev.get("metrics", {}) or {}).items()
                },
            }
        )
    # Segments we have data for but no model for. `segments_not_trained` in the
    # training registry is written by train.py and is empty, which reads as
    # "we trained everything we have" -- the opposite of the truth. Derive it
    # instead: every segment present in the observations minus every segment we
    # actually shipped a model for.
    trained = {m["segment"] for m in models}
    observed = set()
    if OBS_PATH.exists():
        for line in OBS_PATH.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                observed.add(json.loads(line).get("segment"))
            except json.JSONDecodeError:
                continue
    observed.discard(None)
    derived_not_trained = sorted(observed - trained)
    declared_not_trained = reg.get("segments_not_trained") or []
    if declared_not_trained and sorted(declared_not_trained) != derived_not_trained:
        print(
            f"  note: registry declared segments_not_trained={sorted(declared_not_trained)} "
            f"but the data implies {derived_not_trained}; exporting the derived list"
        )

    return {
        "featureSchemaVersion": reg.get("feature_schema_version"),
        "target": reg.get("target"),
        "targetSemantics": reg.get("target_semantics"),
        "geography": reg.get("geography", {}),
        "segmentsNotTrained": derived_not_trained,
        "segmentsObserved": sorted(observed),
        "productionModelId": models[0]["modelId"] if models else None,
        "models": models,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="Export runtime artefacts for the Next.js valuation layer")
    ap.add_argument("--max-samples-per-bucket", type=int, default=DEFAULT_MAX_SAMPLES)
    ap.add_argument("--max-buckets", type=int, default=DEFAULT_MAX_BUCKETS)
    args = ap.parse_args(argv)

    if not OBS_PATH.exists():
        print(f"missing observations: {OBS_PATH}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    comp = build_comparables(args.max_samples_per_bucket, args.max_buckets)
    comp["generated_at"] = None
    (OUT_DIR / "comparables.json").write_text(json.dumps(comp, separators=(",", ":")), encoding="utf-8")

    reg = build_registry()
    (OUT_DIR / "registry.json").write_text(json.dumps(reg, indent=1), encoding="utf-8")

    cpath = OUT_DIR / "comparables.json"
    rpath = OUT_DIR / "registry.json"
    print(f"comparables: {comp['buckets']} buckets / {comp['total_observations']} observations -> {cpath} ({cpath.stat().st_size/1024:.0f} KB)")
    print(f"registry   : {len(reg['models'])} model(s) -> {rpath} ({rpath.stat().st_size/1024:.0f} KB)")
    print(f"dropped as low-volume: {comp['buckets_dropped_as_low_volume']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
