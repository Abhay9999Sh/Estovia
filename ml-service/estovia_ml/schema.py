"""Canonical observation schema + validation rules.

A MarketObservation is one real-world advertisement/transaction observation.
Field definitions live here (not in the DB layer) so the Python pipeline and
the Next.js inference layer cannot drift: both import the same names via
docs, and `feature_schema_version()` is stamped onto every model artifact.
"""

from dataclasses import dataclass, field, asdict
from typing import Any, Optional

SCHEMA_VERSION = "obs.v1"

# --- Property categories. The engine keeps these separate because a plot,
# a flat and a villa do not share a price structure. -------------------------
CAT_LAND_RESIDENTIAL = "land_residential"
CAT_LAND_AGRICULTURAL = "land_agricultural"
CAT_LAND_COMMERCIAL = "land_commercial"
CAT_APARTMENT = "apartment"
CAT_INDEPENDENT_HOUSE = "independent_house"
CAT_VILLA = "villa"
CAT_PLOT = "plot"
CAT_COMMERCIAL_UNIT = "commercial_unit"

PROPERTY_CATEGORIES = [
    CAT_LAND_RESIDENTIAL,
    CAT_LAND_AGRICULTURAL,
    CAT_LAND_COMMERCIAL,
    CAT_APARTMENT,
    CAT_INDEPENDENT_HOUSE,
    CAT_VILLA,
    CAT_PLOT,
    CAT_COMMERCIAL_UNIT,
]

# Model segments. Each segment gets its own model only if it has enough data
# AND beats the baseline out-of-sample; otherwise it shares a model with
# category features and the limitation is reported.
SEGMENT_LAND = "land"
SEGMENT_RESIDENTIAL_BUILTUP = "builtup"
SEGMENT_COMMERCIAL = "commercial"

SEGMENTS = [SEGMENT_LAND, SEGMENT_RESIDENTIAL_BUILTUP, SEGMENT_COMMERCIAL]

SEGMENT_CATEGORY = {
    SEGMENT_LAND: [
        CAT_LAND_RESIDENTIAL,
        CAT_LAND_AGRICULTURAL,
        CAT_LAND_COMMERCIAL,
        CAT_PLOT,
    ],
    SEGMENT_RESIDENTIAL_BUILTUP: [
        CAT_APARTMENT,
        CAT_INDEPENDENT_HOUSE,
        CAT_VILLA,
    ],
    SEGMENT_COMMERCIAL: [CAT_COMMERCIAL_UNIT],
}

CATEGORY_SEGMENT = {}
for _seg, _cats in SEGMENT_CATEGORY.items():
    for _c in _cats:
        CATEGORY_SEGMENT[_c] = _seg

# Area definitions. Getting this wrong is the single easiest way to produce a
# confidently incorrect price, so the definition travels with every number.
AREA_BUILTUP = "built_up"
AREA_CARPET = "carpet"
AREA_PLOT = "plot"
AREA_TOTAL = "total"

AREA_DEFINITIONS = [AREA_BUILTUP, AREA_CARPET, AREA_PLOT, AREA_TOTAL]

PROPERTY_AGE_BUCKETS = ["new", "0_2", "2_5", "5_10", "10_15", "15_plus", "unknown"]

# Model geography. Everything outside this set is rejected at validation with
# reason 'outside_model_geography' rather than being silently coerced.
NCR_CITIES = ["New Delhi", "Gurugram", "Noida", "Greater Noida", "Ghaziabad", "Faridabad"]

FURNISHING = ["unfurnished", "semi_furnished", "furnished", "unknown"]

OWNERSHIP = ["freehold", "leasehold", "society", "unknown"]

TRANSACTION_TYPE = ["new_property", "resale", "unknown"]


@dataclass
class Observation:
    """One normalized real-world observation."""

    # --- provenance (never fabricated) ---
    source_key: str
    source_record_id: str
    source_url: str
    retrieved_at: str
    target_type: str
    observed_date: Optional[str] = None  # None when the source exposes none

    # --- geography ---
    city: Optional[str] = None
    locality: Optional[str] = None
    sub_locality: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # --- property ---
    property_category: str = CAT_APARTMENT
    segment: str = SEGMENT_RESIDENTIAL_BUILTUP
    title: Optional[str] = None
    builder_name: Optional[str] = None
    project_name: Optional[str] = None

    # --- area (canonical: square feet) ---
    area_sqft: Optional[float] = None
    area_definition: str = AREA_BUILTUP
    area_value_original: Optional[float] = None
    area_unit_original: Optional[str] = None

    # --- configuration ---
    bedrooms: Optional[float] = None
    bathrooms: Optional[float] = None
    balconies: Optional[float] = None
    floor_number: Optional[float] = None
    total_floors: Optional[float] = None
    property_age_years: Optional[float] = None
    facing: Optional[str] = None
    furnishing: Optional[str] = None
    ownership: Optional[str] = None
    transaction_type: Optional[str] = None
    lift_available: Optional[bool] = None
    parking_count: Optional[float] = None

    amenities: list[str] = field(default_factory=list)
    amenity_flags: dict[str, Any] = field(default_factory=dict)

    # --- target ---
    price_inr: Optional[float] = None
    price_per_sqft_inr: Optional[float] = None
    price_basis: Optional[str] = None  # e.g. 'total_price_advertised'

    # --- geospatial derived (filled by features stage) ---
    geo_features: dict[str, Any] = field(default_factory=dict)

    # --- quality ---
    quality_flags: list[str] = field(default_factory=list)
    is_demo: bool = False
    license_key: Optional[str] = None
    non_commercial: bool = False
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        return asdict(self)


# Sanity envelopes for Delhi NCR. These are *flagging* bounds, not automatic
# deletion thresholds — see validation.py for the documented outlier policy.
PLAUSIBILITY = {
    "price_per_sqft_min": 300.0,
    "price_per_sqft_max": 400_000.0,
    "price_total_min": 500_000.0,
    "price_total_max": 5_000_000_000.0,
    "builtup_area_min_sqft": 150.0,
    "builtup_area_max_sqft": 200_000.0,
    "land_area_min_sqft": 200.0,
    "land_area_max_sqft": 4_000_000.0,
    "bedrooms_max": 30.0,
    "bathrooms_max": 30.0,
    "floors_max": 90.0,
    "lat_range": (28.30, 29.60),   # NCR bounding envelope
    "lon_range": (76.70, 78.10),
}


def feature_schema_version():
    return "feat.v1"
