"""Feature engineering.

Two design rules that matter more than model choice:

1. NO LEAKAGE. Every learned transform (imputer, scaler, encoder) is fitted on
   the training fold only. Locality is high-cardinality, so it is encoded with
   out-of-fold target statistics computed strictly inside the training fold,
   with smoothing, and an explicit "unseen locality" fallback. We never let a
   model's own predictions on a training row become a feature for that row.

2. The target is log(price per sq. ft.), not total price. Total price is
   dominated by area and lets a tree model "explain" everything with area.
   Price per unit area is what actually varies with location and quality, and
   multiplying back by area keeps the model scale-free. Both targets are
   evaluated and the winner is chosen on the held-out set.

Geospatial features come from OpenStreetMap via Overpass (see geospatial.py)
and are optional: when a tile was not fetched, the feature block is marked
unavailable rather than filled with zeros that would look like "no amenities".
"""

from __future__ import annotations

import math
from collections import defaultdict

import numpy as np

from .geospatial import CATEGORIES, FEATURE_NAMES, haversine_km
from .schema import (
    AREA_CARPET,
    CAT_APARTMENT,
    CAT_INDEPENDENT_HOUSE,
    CAT_LAND_AGRICULTURAL,
    CAT_LAND_COMMERCIAL,
    CAT_LAND_RESIDENTIAL,
    CAT_PLOT,
    CAT_VILLA,
    PROPERTY_CATEGORIES,
    SEGMENT_LAND,
    feature_schema_version,
)

CATEGORIES_ORDER = PROPERTY_CATEGORIES

# Feature groups, each with a human label for the explainability UI.
FEATURE_GROUPS = {
    "area_sqft": "Property area",
    "bedrooms": "Bedrooms",
    "bathrooms": "Bathrooms",
    "balconies": "Balconies",
    "floor_number": "Floor level",
    "total_floors": "Building height",
    "property_age_years": "Property age",
    "lift_available": "Lift availability",
    "parking_count": "Parking",
    "amenity_count_source": "Amenities listed in the advertisement",
    "furnishing_ord": "Furnishing",
    "facing_ord": "Facing",
    "ownership_ord": "Ownership type",
    "transaction_ord": "New build vs resale",
    "area_definition_ord": "Area basis (carpet vs built-up)",
    "is_ground_floor": "Ground floor",
    "is_top_floor": "Top floor",
    "floor_ratio": "Floor position within building",
    "is_new_build": "New construction",
    "has_coordinates": "Precise coordinates available",
    "city": "City",
    "locality_te": "Locality market level",
    "log_locality_freq": "How often this locality appears in the market",
    "dist_metro_km": "Distance to metro",
    "dist_rail_station_km": "Distance to railway station",
    "dist_bus_stop_km": "Distance to bus stop",
    "dist_hospital_km": "Distance to hospital",
    "dist_school_km": "Distance to school / college",
    "dist_park_km": "Distance to park",
    "dist_mall_km": "Distance to mall / retail",
    "dist_market_km": "Distance to market",
    "dist_airport_km": "Distance to airport",
    "dist_major_road_km": "Distance to major road",
    "metro_within_1km": "Metro within 1 km",
    "metro_within_3km": "Metro within 3 km",
    "hospital_within_2km": "Hospital within 2 km",
    "school_within_1km": "School within 1 km",
    "park_within_1km": "Park within 1 km",
    "mall_within_3km": "Mall within 3 km",
    "amenity_score_1km": "Amenity count within 1 km",
    "amenity_score_3km": "Amenity count within 3 km",
    "amenity_index": "Composite accessibility index",
    "geo_data_available": "Geospatial data available for this area",
    "log_bed_area_ratio": "Bedrooms per 1000 sq ft",
}

NUMERIC_FEATURES = [
    "log_area_sqft",
    "bedrooms",
    "bathrooms",
    "balconies",
    "floor_number",
    "total_floors",
    "floor_ratio",
    "is_ground_floor",
    "is_top_floor",
    "property_age_years",
    "is_new_build",
    "lift_available",
    "parking_count",
    "amenity_count_source",
    "furnishing_ord",
    "facing_ord",
    "ownership_ord",
    "transaction_ord",
    "area_definition_ord",
    "has_coordinates",
    "log_bed_area_ratio",
]

CATEGORICAL_FEATURES = ["city", "property_category", "locality_te"]

GEO_FEATURES = [f for f in FEATURE_NAMES if not f.startswith("dist_") or True]


def _safe_log(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return np.nan
    if v <= 0 or not math.isfinite(v):
        return np.nan
    return math.log(v)


FURNISHING_ORD = {"unfurnished": 0, "semi_furnished": 1, "furnished": 2, "unknown": 1}
FACING_ORD = {
    "north": 0.45,
    "north_east": 0.625,
    "east": 1.0,
    "south_east": 0.375,
    "south": 0.55,
    "south_west": 0.125,
    "west": 0.375,
    "north_west": 0.875,
}
OWNERSHIP_ORD = {"leasehold": 0, "freehold": 1, "society": 1, "unknown": 0.5}
TRANSACTION_ORD = {"new_property": 0, "resale": 1, "unknown": 0.5}
AREA_DEF_ORD = {"carpet": 0, "built_up": 1, "plot": 0.5, "total": 1}

_MISSING = {
    "bedrooms": 2.5,
    "bathrooms": 2.0,
    "balconies": 1.0,
    "floor_number": 4.0,
    "total_floors": 8.0,
    "floor_ratio": 0.4,
    "property_age_years": 5.0,
    "is_new_build": 0,
    "lift_available": 0,
    "parking_count": 1.0,
    "amenity_count_source": 3.0,
}


class FeatureBuilder:
    """Turns Observations into a numeric matrix + target.

    Fitted state (medians, locality statistics) is learned from training rows
    only via `fit()`.
    """

    def __init__(self, segment=SEGMENT_LAND):
        self.segment = segment
        self.medians = {}
        self.locality_stats = {}
        self.locality_freq = {}
        self.city_stats = {}
        self.category_stats = {}
        self.global_median_ppsf = None
        self.locality_coverage = 0.0
        self.feature_names = None
        self.schema_version = feature_schema_version()

    # -- raw (non-leaky) row construction ----------------------------------
    def _base_row(self, o, locality_te, city_te, category_te, freq):
        area = float(o.area_sqft or 0)
        floor = o.floor_number
        total = o.total_floors
        floor_ratio = (floor + 1) / total if (floor is not None and total) else None
        amenity_count = float(len(o.amenities or [])) if o.amenities else None
        if amenity_count is None and o.amenity_flags:
            # Source-supplied amenity matrix: count of positive flags.
            amenity_count = float(sum(1 for v in o.amenity_flags.values() if v))
        age = o.property_age_years
        row = {
            "log_area_sqft": _safe_log(area),
            "bedrooms": o.bedrooms,
            "bathrooms": o.bathrooms,
            "balconies": o.balconies,
            "floor_number": floor,
            "total_floors": total,
            "floor_ratio": floor_ratio,
            "is_ground_floor": (1 if floor == 0 else 0) if floor is not None else None,
            "is_top_floor": (
                1 if (floor is not None and total is not None and floor >= total - 1) else 0
            )
            if (floor is not None and total is not None)
            else None,
            "property_age_years": age,
            "is_new_build": (1 if (age is not None and age <= 1.0) else 0),
            "lift_available": (1 if o.lift_available else 0) if o.lift_available is not None else None,
            "parking_count": o.parking_count,
            "amenity_count_source": amenity_count,
            "furnishing_ord": FURNISHING_ORD.get(o.furnishing),
            "facing_ord": FACING_ORD.get(o.facing),
            "ownership_ord": OWNERSHIP_ORD.get(o.ownership),
            "transaction_ord": TRANSACTION_ORD.get(o.transaction_type),
            "area_definition_ord": AREA_DEF_ORD.get(o.area_definition),
            "has_coordinates": 1 if (o.latitude is not None and o.longitude is not None) else 0,
            "log_bed_area_ratio": _safe_log(
                (o.bedrooms or np.nan) / area * 1000 if area else np.nan
            ),
            "locality_te": locality_te,
            "log_locality_freq": _safe_log(freq) if freq else np.nan,
            "property_category": CATEGORIES_ORDER.index(o.property_category)
            if o.property_category in CATEGORIES_ORDER
            else -1,
            "_city_te": city_te,
            "_category_te": category_te,
        }
        geo = o.geo_features or {}
        for name in FEATURE_NAMES:
            row[name] = geo.get(name)
        row["geo_data_available"] = 1 if geo.get("osm_ok") else 0
        return row

    # -- fitting ------------------------------------------------------------
    def fit(self, observations, targets):
        """Learn imputation medians and smoothed target statistics.

        `targets` is the log price-per-sqft array aligned with `observations`.
        Locality statistics here are IN-SAMPLE statistics of the training fold.
        They are only used to encode rows that are NOT in the training fold; for
        training rows the caller must supply out-of-fold encodings (see
        `transform` with oof_encodings=True), otherwise the model leaks.
        """
        rows = []
        for o, y in zip(observations, targets):
            rows.append(self._base_row(o, np.nan, np.nan, np.nan, None))
        medians = {}
        for name in NUMERIC_FEATURES + list(FEATURE_NAMES) + ["geo_data_available"]:
            vals = [r[name] for r in rows if r.get(name) is not None and np.isfinite(r[name] if isinstance(r[name], (int, float, np.floating)) else np.nan)]
            if vals:
                medians[name] = float(np.median(vals))
        self.medians = medians

        self.global_median_ppsf = float(np.median(targets))

        loc_sum = defaultdict(float)
        loc_cnt = defaultdict(int)
        city_sum = defaultdict(float)
        city_cnt = defaultdict(int)
        cat_sum = defaultdict(float)
        cat_cnt = defaultdict(int)
        freq = defaultdict(int)
        for o, y in zip(observations, targets):
            loc = o.locality or "__none__"
            loc_sum[loc] += y
            loc_cnt[loc] += 1
            freq[loc] += 1
            city_sum[o.city or "__none__"] += y
            city_cnt[o.city or "__none__"] += 1
            cat_sum[o.property_category] += y
            cat_cnt[o.property_category] += 1
        self.locality_stats = self._smoothed(loc_sum, loc_cnt)
        self.city_stats = self._smoothed(city_sum, city_cnt)
        self.category_stats = self._smoothed(cat_sum, cat_cnt)
        self.locality_freq = dict(freq)
        covered = sum(1 for o in observations if (o.locality or "__none__") in loc_cnt and loc_cnt[o.locality or "__none__"] >= MIN_LOCALITY_OBS)
        self.locality_coverage = covered / max(1, len(observations))

        order = NUMERIC_FEATURES + CATEGORIES_ORDER_LIST()
        self.feature_names = order
        return self

    def _smoothed(self, sums, counts, k=20.0):
        """Smoothed target encoding: (sum + k*global_mean) / (count + k)."""
        g = self.global_median_ppsf if self.global_median_ppsf is not None else 0.0
        return {key: (sums[key] + k * g) / (counts[key] + k) for key in sums}

    # -- transformation -----------------------------------------------------
    def transform(self, observations, oof_locality=None):
        """Build the model matrix.

        `oof_locality` maps index -> locality encoding. For TRAINING rows pass
        leave-one-out encodings (or out-of-fold) to avoid self-leakage; for
        VALIDATION/TEST rows pass None so the training-fitted encoding is used.
        """
        rows = []
        for i, o in enumerate(observations):
            loc = o.locality or "__none__"
            if oof_locality is not None:
                locality_te = oof_locality[i]
            else:
                locality_te = self.locality_stats.get(loc, self.global_median_ppsf)
            city_te = self.city_stats.get(o.city or "__none__", self.global_median_ppsf)
            category_te = self.category_stats.get(o.property_category, self.global_median_ppsf)
            row = self._base_row(o, locality_te, city_te, category_te, self.locality_freq.get(loc))
            for name in self.medians:
                v = row.get(name)
                if v is None or (isinstance(v, float) and not math.isfinite(v)):
                    row[name] = self.medians[name]
            for name in FEATURE_NAMES:
                if row.get(name) is None or (
                    isinstance(row.get(name), float) and not math.isfinite(row[name])
                ):
                    row[name] = self.medians.get(name, 0.0)
            row["property_category"] = row["property_category"]
            rows.append(row)

        matrix = np.zeros((len(rows), len(self.feature_names)), dtype=np.float64)
        for j, name in enumerate(self.feature_names):
            for i, row in enumerate(rows):
                v = row.get(name)
                matrix[i, j] = float(v) if v is not None else np.nan
        # Any residual NaN -> training median.
        for j, name in enumerate(self.feature_names):
            col = matrix[:, j]
            bad = ~np.isfinite(col)
            if bad.any():
                col[bad] = self.medians.get(name, 0.0)
        return matrix


def CATEGORIES_ORDER_LIST():
    return [
        "locality_te",
        "log_locality_freq",
        "_city_te",
        "_category_te",
        "property_category",
        "geo_data_available",
    ] + FEATURE_NAMES


MIN_LOCALITY_OBS = 8


def build_matrix(builder, observations, y=None, oof_locality=None):
    return builder.transform(observations, oof_locality=oof_locality)


def leave_one_out_locality(observations, y, builder, k=20.0, n_folds=5):
    """Out-of-fold locality encodings for TRAINING rows.

    For each fold, the encoding for a row is computed from the OTHER folds only
    (and for the row's own fold, a leave-one-out adjustment). This is the
    standard guard against a tree memorising 'locality X always means price Y'
    from its own label.
    """
    n = len(observations)
    folds = np.arange(n) % n_folds
    out = np.zeros(n, dtype=np.float64)
    g = builder.global_median_ppsf or 0.0

    locs = [o.locality or "__none__" for o in observations]

    # fold_loc_sum[f] = sum of y over locality l for all rows NOT in fold f.
    fold_loc_sum = [defaultdict(float) for _ in range(n_folds)]
    fold_loc_cnt = [defaultdict(int) for _ in range(n_folds)]
    for i in range(n):
        f = folds[i]
        for ff in range(n_folds):
            if ff == f:
                continue
            fold_loc_sum[ff][locs[i]] += y[i]
            fold_loc_cnt[ff][locs[i]] += 1

    for i in range(n):
        f = folds[i]
        # Exclude fold f, then also exclude this row's own label.
        s = fold_loc_sum[f].get(locs[i], 0.0) - y[i]
        c = fold_loc_cnt[f].get(locs[i], 0) - 1
        out[i] = (s + k * g) / (c + k)
    return out


def group_key(o):
    """Grouping key that keeps the same physical listing out of two splits."""
    base = f"{o.city}|{o.locality or ''}|{o.project_name or ''}|{o.property_category}"
    return f"{base}|{int(round((o.price_inr or 0) / 100000))}"


def locality_key(o):
    return f"{o.city}|{o.locality or '__none__'}"
