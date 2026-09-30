"""Ingestion pipeline: adapters -> validated, deduplicated observations.

Run directly for a report:
    python -m estovia_ml.ingest --report

Write normalised observations to JSONL for the training stage:
    python -m estovia_ml.ingest --out data/processed/observations.jsonl
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from dataclasses import asdict
from pathlib import Path

from .adapters import ACTIVE_ADAPTERS, DATA_DIR, Gurgaon2023Adapter
from .sources import REGISTRY
from .validation import validate_and_dedupe

PROCESSED = DATA_DIR / "processed"
LOG_PATH = DATA_DIR / "processed" / "ingestion_log.json"


def allow_noncommercial():
    return os.environ.get("ESTOVIA_ALLOW_NONCOMMERCIAL_SOURCES", "").lower() in {
        "1",
        "true",
        "yes",
    }


def run_adapters(keys=None, verbose=True):
    """Fetch + parse every requested adapter. Returns (raw, per_source_log)."""
    raw = []
    log = []

    selected = keys or list(ACTIVE_ADAPTERS)
    for key in selected:
        cls = ACTIVE_ADAPTERS[key]
        spec = REGISTRY[key]
        entry = {
            "source_key": key,
            "name": spec.name,
            "url": spec.url,
            "target_type": spec.target_type,
            "license": spec.license,
            "commercial_use": spec.commercial_use,
            "status": "ok",
            "records_raw": 0,
            "error": None,
        }
        try:
            adapter = cls()
            recs = adapter.run()
            entry["records_raw"] = len(recs)
            raw.extend(recs)
            if verbose:
                print(f"  [{key}] raw={len(recs)}")
        except Exception as exc:  # noqa: BLE001
            entry["status"] = "failed"
            entry["error"] = f"{type(exc).__name__}: {exc}"
            if verbose:
                print(f"  [{key}] FAILED: {entry['error']}")
        log.append(entry)

    # Non-commercial source, gated by explicit env opt-in.
    if allow_noncommercial() and (keys is None or "kaggle_gurgaon_99acres_2023" in keys):
        spec = REGISTRY["kaggle_gurgaon_99acres_2023"]
        for member in ("flats", "houses", "land"):
            entry = {
                "source_key": f"{spec.key}:{member}",
                "name": f"{spec.name} [{member}]",
                "url": spec.url,
                "target_type": spec.target_type,
                "license": spec.license,
                "commercial_use": False,
                "status": "ok",
                "records_raw": 0,
                "error": None,
            }
            try:
                recs = Gurgaon2023Adapter(member=member).run()
                entry["records_raw"] = len(recs)
                raw.extend(recs)
                if verbose:
                    print(f"  [{spec.key}:{member}] raw={len(recs)} (NON-COMMERCIAL)")
            except Exception as exc:  # noqa: BLE001
                entry["status"] = "failed"
                entry["error"] = f"{type(exc).__name__}: {exc}"
            log.append(entry)
    elif keys is None or "kaggle_gurgaon_99acres_2023" in keys:
        log.append(
            {
                "source_key": "kaggle_gurgaon_99acres_2023",
                "name": REGISTRY["kaggle_gurgaon_99acres_2023"].name,
                "url": REGISTRY["kaggle_gurgaon_99acres_2023"].url,
                "target_type": "asking_price",
                "license": "CC BY-NC-SA 4.0",
                "commercial_use": False,
                "status": "skipped",
                "records_raw": 0,
                "error": (
                    "non-commercial licence. Set ESTOVIA_ALLOW_NONCOMMERCIAL_SOURCES=1 "
                    "to ingest for research use."
                ),
            }
        )

    return raw, log


def build_dataset(keys=None, verbose=True):
    raw, source_log = run_adapters(keys=keys, verbose=verbose)
    accepted, rejections, stats = validate_and_dedupe(raw)

    by_source = Counter(o.source_key for o in accepted)
    for entry in source_log:
        entry["records_accepted"] = by_source.get(entry["source_key"], 0)

    report = {
        "records_raw": len(raw),
        "records_accepted": len(accepted),
        "records_rejected": len(rejections),
        "rejection_reasons": dict(Counter(r.reason for r in rejections)),
        "validation_stats": stats,
        "by_source": dict(by_source),
        "by_category": dict(Counter(o.property_category for o in accepted)),
        "by_segment": dict(Counter(o.segment for o in accepted)),
        "by_city": dict(Counter(o.city for o in accepted)),
        "with_coordinates": sum(1 for o in accepted if o.latitude is not None),
        "with_observed_date": sum(
            1 for o in accepted if o.observed_date is not None
        ),
        "target_type": "asking_price",
        "sources": source_log,
    }
    return accepted, rejections, report


def write_jsonl(observations, path=None):
    path = Path(path or (PROCESSED / "observations.jsonl"))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for o in observations:
            fh.write(json.dumps(asdict(o), ensure_ascii=False) + "\n")
    return path


def write_report(report, rejections, path=None):
    path = Path(path or LOG_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "report": report,
        "rejected_sample": [r.to_dict() for r in rejections[:500]],
        "rejected_total": len(rejections),
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description="Estovia real-data ingestion")
    ap.add_argument("--sources", nargs="*", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args(argv)

    print("Estovia ingestion — real sources only, no synthetic fallback")
    accepted, rejections, report = build_dataset(keys=args.sources)

    if args.out or not args.report:
        out = write_jsonl(accepted, args.out)
        print(f"wrote {len(accepted)} observations -> {out}")
        log = write_report(report, rejections)
        print(f"wrote ingestion log -> {log}")

    if args.report:
        print(json.dumps(report, indent=2, ensure_ascii=False)[:4000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
