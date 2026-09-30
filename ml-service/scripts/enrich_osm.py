"""Attach OpenStreetMap accessibility features to the observation set.

    python scripts/enrich_osm.py --budget 80

Writes data/processed/observations_enriched.jsonl. Tiles are cached under
data/osm_cache/tiles so re-runs are free and the Overpass public endpoint is
respected.
"""

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from estovia_ml.geospatial import enrich_observations, needed_tiles  # noqa: E402
from estovia_ml.train import load_observations  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="data/processed/observations.jsonl")
    ap.add_argument("--output", default="data/processed/observations_enriched.jsonl")
    ap.add_argument("--budget", type=int, default=80)
    ap.add_argument("--include-noncommercial", action="store_true", default=True)
    args = ap.parse_args()

    obs = load_observations(
        Path(args.input), include_noncommercial=args.include_noncommercial
    )
    with_coords = sum(1 for o in obs if o.latitude is not None)
    tiles = needed_tiles(obs)
    print(f"observations={len(obs)} with_coordinates={with_coords} tiles_needed={len(tiles)}")
    top = sorted(tiles.items(), key=lambda kv: kv[1], reverse=True)[:10]
    print("densest tiles:", [(f"{k[0]},{k[1]}", n) for k, n in top])

    n, used = enrich_observations(obs, budget=args.budget)
    print(f"enriched {n} observations using {used} tiles")

    out = ROOT / args.output
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        for o in obs:
            fh.write(json.dumps(asdict(o), ensure_ascii=False) + "\n")
    print("wrote", out)


if __name__ == "__main__":
    main()
