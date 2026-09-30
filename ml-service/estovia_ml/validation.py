"""Validation, deduplication and rejection logging.

Policy decisions, stated explicitly because they materially affect results:

1. We do NOT silently drop outliers. A record is either accepted (possibly
   with quality_flags) or rejected WITH a recorded reason. Genuine luxury and
   distressed properties exist and must survive to the model.
2. Implausibility bounds are derived from the observed Delhi NCR distribution
   plus hard domain limits, and they FLAG rather than delete unless the record
   is physically impossible (missing price, non-positive area, coordinates
   outside the NCR envelope for a Delhi-NCR claim).
3. The Estovia demo listings in src/lib/demoData.js are never ingested, and
   `is_demo` is asserted False on every record that reaches the model.
4. Deduplication is by (source, source_record_id) then by content fingerprint.
   Cross-source near-duplicates are collapsed but the duplicate keys are
   retained so we can report how much overlap existed.
"""

from __future__ import annotations

import hashlib
import math
from collections import defaultdict

from .parsing import normalize_city
from .schema import (
    AREA_PLOT,
    CAT_LAND_AGRICULTURAL,
    CAT_LAND_COMMERCIAL,
    CAT_LAND_RESIDENTIAL,
    CAT_PLOT,
    NCR_CITIES,
    PLAUSIBILITY,
)


class Rejection:
    __slots__ = ("source_key", "source_record_id", "reason", "detail")

    def __init__(self, source_key, source_record_id, reason, detail=""):
        self.source_key = source_key
        self.source_record_id = source_record_id
        self.reason = reason
        self.detail = detail

    def to_dict(self):
        return {
            "source_key": self.source_key,
            "source_record_id": self.source_record_id,
            "reason": self.reason,
            "detail": self.detail,
        }


def _finite(x):
    return x is not None and isinstance(x, (int, float)) and math.isfinite(x)


def validate(obs):
    """Return (accepted_bool, reason, detail)."""
    qf = obs.quality_flags

    if obs.is_demo:
        return False, "demo_record", "record flagged as demo/sample data"

    if not _finite(obs.price_inr) or obs.price_inr <= 0:
        return False, "missing_or_invalid_price", f"price={obs.price_inr!r}"
    if obs.price_inr < PLAUSIBILITY["price_total_min"]:
        return False, "price_below_floor", f"price={obs.price_inr}"
    if obs.price_inr > PLAUSIBILITY["price_total_max"]:
        return False, "price_above_ceiling", f"price={obs.price_inr}"

    if not _finite(obs.area_sqft) or obs.area_sqft <= 0:
        return False, "missing_or_invalid_area", f"area={obs.area_sqft!r}"

    is_land = obs.property_category in (
        CAT_LAND_RESIDENTIAL,
        CAT_LAND_AGRICULTURAL,
        CAT_LAND_COMMERCIAL,
        CAT_PLOT,
    )
    lo, hi = (
        (PLAUSIBILITY["land_area_min_sqft"], PLAUSIBILITY["land_area_max_sqft"])
        if is_land
        else (PLAUSIBILITY["builtup_area_min_sqft"], PLAUSIBILITY["builtup_area_max_sqft"])
    )
    if obs.area_sqft < lo:
        return False, "area_below_floor", f"area_sqft={obs.area_sqft} min={lo}"
    if obs.area_sqft > hi:
        return False, "area_above_ceiling", f"area_sqft={obs.area_sqft} max={hi}"

    # Coordinate sanity. A point outside the NCR envelope on a record that
    # claims an NCR city is a geocoding failure, not a luxury property.
    if obs.latitude is not None and obs.longitude is not None:
        lat_lo, lat_hi = PLAUSIBILITY["lat_range"]
        lon_lo, lon_hi = PLAUSIBILITY["lon_range"]
        inside = lat_lo <= obs.latitude <= lat_hi and lon_lo <= obs.longitude <= lon_hi
        if not inside:
            qf.append("coordinates_outside_ncr")
    if obs.latitude is not None and not (-90 <= obs.latitude <= 90):
        return False, "invalid_latitude", str(obs.latitude)
    if obs.longitude is not None and not (-180 <= obs.longitude <= 180):
        return False, "invalid_longitude", str(obs.longitude)

    if obs.city and obs.city not in NCR_CITIES:
        return False, "outside_model_geography", str(obs.city)

    for attr, cap in (
        ("bedrooms", PLAUSIBILITY["bedrooms_max"]),
        ("bathrooms", PLAUSIBILITY["bathrooms_max"]),
        ("balconies", PLAUSIBILITY["bathrooms_max"]),
        ("total_floors", PLAUSIBILITY["floors_max"]),
        ("floor_number", PLAUSIBILITY["floors_max"]),
    ):
        v = getattr(obs, attr)
        if v is not None and (not _finite(v) or v < 0 or v > cap):
            setattr(obs, attr, None)
            qf.append(f"cleared_{attr}")

    # Soft flags for values that are unusual but plausible. These records are
    # KEPT — a luxury DLF penthouse really does trade above the p99.
    ppsf = obs.price_per_sqft_inr
    if _finite(ppsf):
        if ppsf < PLAUSIBILITY["price_per_sqft_min"]:
            qf.append("very_low_price_per_sqft")
        elif ppsf > PLAUSIBILITY["price_per_sqft_max"]:
            qf.append("very_high_price_per_sqft")
    else:
        obs.price_per_sqft_inr = obs.price_inr / obs.area_sqft

    if obs.area_definition is None:
        obs.area_definition = AREA_PLOT if is_land else "built_up"

    if not _finite(obs.price_per_sqft_inr) or obs.price_per_sqft_inr <= 0:
        return False, "invalid_price_per_sqft", str(obs.price_per_sqft_inr)

    return True, None, None


def fingerprint(obs):
    """Content fingerprint for near-duplicate detection."""
    parts = [
        obs.property_category or "",
        obs.city or "",
        (obs.locality or "").lower(),
        obs.title or "",
        f"{obs.price_inr:.0f}" if obs.price_inr else "",
        f"{obs.area_sqft:.0f}" if obs.area_sqft else "",
        f"{obs.bedrooms:.0f}" if obs.bedrooms is not None else "",
    ]
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


def spatial_key(obs):
    """Coarser key for 'same unit advertised twice' detection."""
    if obs.latitude is None or obs.longitude is None:
        return None
    return (
        f"{obs.property_category}|{obs.city}|{obs.locality or ''}|"
        f"{round(obs.latitude, 3)},{round(obs.longitude, 3)}|"
        f"{obs.price_inr:.0f}|{obs.area_sqft:.0f}"
    )


def validate_and_dedupe(observations):
    """Returns (accepted, rejections, stats)."""
    accepted = []
    rejections = []
    stats = defaultdict(int)

    seen_source_ids = set()
    seen_fingerprints = set()
    seen_spatial = set()
    # spatial key -> count of near-duplicates already kept
    dup_count = defaultdict(int)

    for obs in observations:
        obs.is_demo = False  # nothing from this pipeline may be demo data
        sid = (obs.source_key, obs.source_record_id)
        if sid in seen_source_ids:
            stats["duplicate_source_id"] += 1
            rejections.append(Rejection(obs.source_key, obs.source_record_id, "duplicate_source_id"))
            continue
        seen_source_ids.add(sid)

        ok, reason, detail = validate(obs)
        if not ok:
            stats[reason] += 1
            rejections.append(Rejection(obs.source_key, obs.source_record_id, reason, detail or ""))
            continue

        fp = fingerprint(obs)
        if fp in seen_fingerprints:
            stats["duplicate_fingerprint"] += 1
            rejections.append(Rejection(obs.source_key, obs.source_record_id, "duplicate_fingerprint"))
            continue
        seen_fingerprints.add(fp)

        sk = spatial_key(obs)
        if sk is not None and sk in seen_spatial:
            dup_count[sk] += 1
            stats["near_duplicate_spatial"] += 1
            obs.quality_flags.append("near_duplicate_spatial")
            # Keep the first observation only; further ones are logged.
            rejections.append(
                Rejection(obs.source_key, obs.source_record_id, "near_duplicate_spatial")
            )
            continue
        if sk is not None:
            seen_spatial.add(sk)

        accepted.append(obs)

    return accepted, rejections, dict(stats)
