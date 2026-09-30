"""Export a compact, binary inference artefact for the Next.js runtime.

Why this exists
---------------
`artifacts/model_<segment>.json` is the human-readable record of the trained
model: 1200 exported trees written with `indent=1`. It is ~22 MB, which is fine
for an archive but too heavy to bundle into a JavaScript route.

This script re-encodes the SAME trees, with no mathematical change, into
parallel typed arrays plus a small JSON header:

    model_<segment>.bin   Float64Array split_conditions / Int32Array indices
    model_<segment>.meta.json

Node layout, in order, after the JSON header (each 4-byte array is contiguous;
`default_left` is 1 byte per node and is therefore written LAST so it cannot
break the 4-byte alignment of the array that follows it):

    tree_offsets      int32[nTrees + 1]
    split_indices     int32[nNodes]
    left_children     int32[nNodes]
    right_children    int32[nNodes]
    split_conditions  float64[nNodes]   split threshold at internal nodes, leaf weight at leaves
    default_left      uint8[nNodes]

The evaluator in `src/lib/valuation/model.js` walks these arrays and is
arithmetically identical to `estovia_ml/verify_parity.py::predict_xgboost_json`,
which remains the reference implementation. `verify_parity` is unaffected.

`ml-service/scripts/verify_js_parity.py` proves the two agree and must pass
before a model is promoted.

Trees whose total gain is zero (they cannot change any prediction) are dropped,
and the surviving trees are re-indexed. This is lossless with respect to
predictions.

    python -m scripts.export_runtime_model
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
OUT_DIR = Path(__file__).resolve().parents[2] / "src" / "lib" / "valuation" / "artifacts"

FORMAT_VERSION = 2
MAGIC = b"ESTSVMB"


def derive_locality_freq(segment: str, split_kind: str):
    """Recompute the training-fold locality frequency counts.

    The trained artefact stores `locality_stats` (a smoothed target encoding)
    but not `locality_freq`, which the feature builder also needs in order to
    produce `log_locality_freq`. Without it every inference row would have that
    feature imputed to the median, which is a different model from the one that
    was evaluated.

    The split is deterministic (fixed seed, fixed holdout cities), so the exact
    training fold can be rebuilt here without retraining anything. Returns
    None if the fold cannot be reproduced, in which case the runtime must fall
    back to the median rather than silently using counts from the wrong fold.
    """
    sys.path.insert(0, str(ROOT))
    try:
        from estovia_ml.train import geographic_split, grouped_random_split, load_observations
    except Exception as exc:  # pragma: no cover - depends on optional deps
        print(f"  ! could not derive locality_freq ({exc}); runtime will impute it")
        return None

    obs = load_observations(segment=segment)
    if not obs:
        return None
    seg_obs = [o for o in obs if o.segment == segment]
    try:
        split = geographic_split(seg_obs) if split_kind == "geographic" else grouped_random_split(seg_obs)
    except Exception as exc:  # pragma: no cover
        print(f"  ! could not rebuild the {split_kind} split ({exc})")
        return None

    counts = {}
    for i in split.train_idx:
        key = seg_obs[i].locality or "__none__"
        counts[key] = counts.get(key, 0) + 1
    print(f"  locality_freq derived from {len(split.train_idx)} training-fold observations "
          f"({len(counts)} distinct localities)")
    return counts


def export_segment(segment: str, min_gain: float, split_kind: str = "geographic"):
    art_path = ARTIFACTS / f"model_{segment}.json"
    if not art_path.exists():
        print(f"[{segment}] no artifact at {art_path}")
        return 1
    art = json.loads(art_path.read_text(encoding="utf-8"))
    locality_freq = derive_locality_freq(segment, split_kind)

    est = art["estimator"]
    if est.get("type") != "xgboost":
        print(f"[{segment}] estimator={est.get('type')} is not tree-based; skipped")
        return 0

    trees = est["trees"]
    kept = []
    for t in trees:
        gain = sum(g for g in t["split_conditions"] if g and g > 0)
        if gain > min_gain:
            kept.append(t)
    dropped = len(trees) - len(kept)
    if not kept:
        print(f"[{segment}] every tree had zero gain; refusing to write an empty model")
        return 1

    n_nodes = sum(len(t["split_indices"]) for t in kept)
    # float64, not float32: the array holds split THRESHOLDS as well as leaf
    # weights, and a float32-rounded threshold can flip a comparison and send
    # the row to a completely different leaf. That showed up as a ~3% metric
    # gap against the recorded report, so the extra 1.1 MB is worth it.
    split_conditions = np.zeros(n_nodes, dtype=np.float64)
    split_indices = np.zeros(n_nodes, dtype=np.int32)
    left_children = np.zeros(n_nodes, dtype=np.int32)
    right_children = np.zeros(n_nodes, dtype=np.int32)
    default_left = np.zeros(n_nodes, dtype=np.uint8)
    tree_offsets = np.zeros(len(kept) + 1, dtype=np.int32)

    cursor = 0
    for ti, t in enumerate(kept):
        m = len(t["split_indices"])
        tree_offsets[ti] = cursor
        sl = slice(cursor, cursor + m)
        split_conditions[sl] = np.asarray(t["split_conditions"], dtype=np.float64)
        split_indices[sl] = np.asarray(t["split_indices"], dtype=np.int32)
        left_children[sl] = np.asarray(t["left_children"], dtype=np.int32)
        right_children[sl] = np.asarray(t["right_children"], dtype=np.int32)
        dl = t.get("default_left") or [1] * m
        default_left[sl] = np.asarray(dl, dtype=np.uint8)
        cursor += m
    tree_offsets[len(kept)] = cursor

    header = {
        "format": "estovia-gbm-v2",
        "formatVersion": FORMAT_VERSION,
        "modelId": art["model_id"],
        "version": art["version"],
        "trainedAt": art["trained_at"],
        "segment": art["segment"],
        "estimatorName": art["estimator_name"],
        "target": art["target"],
        "targetHuman": art["target_human"],
        "targetSemantics": art["target_semantics"],
        "featureSchemaVersion": art["feature_schema_version"],
        "featureNames": art["feature_names"],
        "featureGroups": art["feature_groups"],
        "imputationMedians": art["imputation_medians"],
        "localityStats": art["locality_stats"],
        "localityFreq": locality_freq or {},
        "cityStats": art["city_stats"],
        "categoryStats": art["category_stats"],
        "globalMedianLogPpsf": art["global_median_log_ppsf"],
        "localityCoverage": art["locality_coverage"],
        "conformal": art["conformal"],
        "params": art["params"],
        "dependencies": art["dependencies"],
        "baselineEstimator": art.get("baseline_estimator", {}),
        "ensemble": {
            "type": "xgboost",
            "baseScore": float(est["base_score"]),
            "nTrees": len(kept),
            "nNodes": int(n_nodes),
            "treesDroppedAsZeroGain": dropped,
            "minTreeGain": min_gain,
        },
    }

    # JSON header length is needed so the reader knows where the arrays start.
    # The reader computes the array offset as (magic + 8 + headerLength), and
    # that prefix is 15 bytes, so the header is padded until the ABSOLUTE array
    # offset is 8-byte aligned. That is required by Float64Array and is also
    # sufficient for the 4-byte and 1-byte arrays that follow it in order.
    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    prefix_len = len(MAGIC) + 8
    pad = (-(prefix_len + len(header_bytes))) % 8
    header_bytes += b" " * pad
    def pad8(payload: bytes) -> bytes:
        """Every array is padded up to an 8-byte boundary.

        `tree_offsets` is 4*(nTrees+1) bytes, which is not necessarily a
        multiple of 8, so without this the following Float64Array would start
        unaligned and a typed-array view over it would throw. The reader skips
        the same padding, so both sides agree.
        """
        return payload + b"\x00" * ((-len(payload)) % 8)

    blob = bytearray(MAGIC)
    blob += struct.pack("<I", FORMAT_VERSION)
    blob += struct.pack("<I", len(header_bytes))
    blob += header_bytes
    blob += pad8(tree_offsets.tobytes())
    blob += pad8(split_indices.tobytes())
    blob += pad8(left_children.tobytes())
    blob += pad8(right_children.tobytes())
    blob += pad8(split_conditions.tobytes())
    # default_left is 1 byte per node, so it must come last: putting a
    # 1-byte array before an 8-byte array would leave the latter unaligned.
    blob += pad8(default_left.tobytes())

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bin_path = OUT_DIR / f"model_{segment}.bin"
    meta_path = OUT_DIR / f"model_{segment}.meta.json"
    bin_path.write_bytes(bytes(blob))
    meta_path.write_text(json.dumps(header, indent=1), encoding="utf-8")

    src_mb = art_path.stat().st_size / 1024 / 1024
    dst_mb = bin_path.stat().st_size / 1024 / 1024
    print(
        f"[{segment}] {len(kept)} trees ({dropped} zero-gain dropped), {n_nodes} nodes "
        f"-> {dst_mb:.1f} MB (from {src_mb:.1f} MB)  base_score={est['base_score']:.6f}"
    )
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="Export compact binary model artefacts")
    ap.add_argument("--segments", nargs="*", default=["land", "builtup", "commercial"])
    ap.add_argument("--min-gain", type=float, default=0.0, help="drop trees whose summed split gain is <= this")
    ap.add_argument("--split", default="geographic", choices=["geographic", "grouped", "locality"],
                    help="must match the split recorded in the evaluation report")
    args = ap.parse_args(argv)

    code = 0
    for segment in args.segments:
        code |= export_segment(segment, args.min_gain, split_kind=args.split)
    return code


if __name__ == "__main__":
    sys.exit(main())
