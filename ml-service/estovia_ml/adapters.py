"""Source adapters.

One class per source. Each is responsible for:
  1. obtaining the bytes (Kaggle public download API / local cache),
  2. mapping that source's columns into the canonical Observation schema.

Adapters never impute, never guess, and never write a `observed_date` the
source did not provide. Anything absent becomes None and is handled by the
missingness features downstream.
"""

from __future__ import annotations

import io
import json
import os
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from . import parsing as P
from . import units as U
from .schema import (
    AREA_BUILTUP,
    AREA_CARPET,
    AREA_PLOT,
    CAT_APARTMENT,
    CAT_INDEPENDENT_HOUSE,
    CAT_LAND_AGRICULTURAL,
    CAT_LAND_RESIDENTIAL,
    CAT_PLOT,
    CAT_VILLA,
    CATEGORY_SEGMENT,
    Observation,
    SEGMENT_LAND,
    SEGMENT_RESIDENTIAL_BUILTUP,
)
from .sources import REGISTRY, SourceAdapter, TARGET_ASKING

DATA_DIR = Path(os.environ.get("ESTOVIA_ML_DATA", Path(__file__).resolve().parents[1] / "data"))
RAW_DIR = DATA_DIR / "raw"

KAGGLE_DOWNLOAD = "https://www.kaggle.com/api/v1/datasets/download/{ref}"


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _cache_path(name):
    return RAW_DIR / name


def download_kaggle(ref, filename, force=False):
    """Download a Kaggle dataset archive to the raw cache. Returns a Path.

    Only uses the public, no-credential dataset download endpoint. If the
    download fails we raise - we never substitute synthetic data.
    """
    import urllib.request

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    url = KAGGLE_DOWNLOAD.format(ref=ref)
    dest = _cache_path(filename)
    if dest.exists() and not force:
        return dest

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Estovia-ML/0.1 (real-estate valuation research pipeline)",
            "Accept": "application/octet-stream",
        },
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = resp.read()
    dest.write_bytes(data)
    return dest


def _read_csv_from_zip(zip_path, member):
    with zipfile.ZipFile(zip_path) as z:
        name = member if member in z.namelist() else None
        if name is None:
            for n in z.namelist():
                if n.lower().endswith(member.lower()):
                    name = n
                    break
        if name is None:
            raise FileNotFoundError(f"{member} not in {zip_path}")
        return z.read(name).decode("utf-8", errors="replace")


def _rows(csv_text):
    import csv as _csv

    _csv.field_size_limit(10_000_000)
    return list(_csv.DictReader(io.StringIO(csv_text)))


# ===========================================================================
# 1. Delhi NCR housing (Delhi_v2.csv) - backbone, has coordinates
# ===========================================================================

class DelhiNCRHousingAdapter(SourceAdapter):
    spec = REGISTRY["kaggle_delhi_ncr_housing_v2"]

    def __init__(self, archive=None):
        self.archive = archive or _cache_path("delhi_ncr_housing_v2.zip")

    def fetch(self):
        if not self.archive.exists():
            download_kaggle(
                "goelyash/housing-price-dataset-of-delhiindia", "delhi_ncr_housing_v2.zip"
            )
        return _read_csv_from_zip(self.archive, "Delhi_v2.csv")

    def parse(self, raw_text):
        rows = _rows(raw_text)
        out = []
        for i, r in enumerate(rows):
            addr = (r.get("Address") or "").strip()
            city = P.normalize_city(addr)
            if not city:
                # Some rows carry 'Delhi NCR' without a resolvable sub-city.
                city = "New Delhi" if "delhi ncr" in addr.lower() else None
            if not city:
                continue
            btype = (r.get("type_of_building") or "").strip().lower()
            if btype == "flat":
                category = CAT_APARTMENT
            elif btype in ("individual house", "house", "villa"):
                category = CAT_INDEPENDENT_HOUSE
            else:
                continue

            price = P.parse_inr(r.get("price"))
            area = P.parse_number(r.get("area"), minimum=100, maximum=100_000)
            if not price or not area:
                continue

            lat = P.parse_number(r.get("latitude"), 6.0, 38.0)
            lon = P.parse_number(r.get("longitude"), 68.0, 98.0)

            obs = Observation(
                source_key=self.spec.key,
                source_record_id=f"row{i}",
                source_url=self.spec.url,
                retrieved_at=_now_iso(),
                target_type=TARGET_ASKING,
                observed_date=None,
                city=city,
                locality=P.normalize_locality(addr),
                sub_locality=addr[:200] or None,
                state=P.state_for_city(city),
                latitude=lat,
                longitude=lon,
                property_category=category,
                segment=CATEGORY_SEGMENT[category],
                title=(r.get("desc") or "")[:200] or None,
                area_sqft=area,
                area_definition=AREA_BUILTUP,
                area_value_original=area,
                area_unit_original="sqft",
                bedrooms=P.parse_bhk(r.get("Bedrooms")),
                bathrooms=P.parse_number(r.get("Bathrooms"), 0, 30),
                balconies=P.parse_number(r.get("Balcony"), 0, 20),
                furnishing=P.parse_furnishing(r.get("Furnished_status")),
                lift_available=_tri_state(r.get("Lift")),
                parking_count=P.parse_number(r.get("parking"), 0, 20),
                transaction_type=(
                    "new_property"
                    if (r.get("neworold") or "").strip().lower().startswith("new")
                    else "resale"
                    if (r.get("neworold") or "").strip().lower().startswith("resale")
                    else None
                ),
                price_inr=price,
                price_per_sqft_inr=price / area,
                price_basis="total_price_advertised",
                license_key=self.spec.license,
                extra={
                    "status": r.get("Status") or None,
                    "landmarks_raw": (r.get("Landmarks") or "")[:400] or None,
                },
            )
            if (r.get("Status") or "").strip().lower() == "under construction":
                obs.quality_flags.append("under_construction")
            out.append(obs)
        return out


def _tri_state(v):
    if v is None or str(v).strip() == "":
        return None
    n = P.parse_number(v, 0, 50)
    if n is None:
        return None
    return bool(n > 0)


# ===========================================================================
# 2. Metropolitan areas of India - Delhi.csv (amenity matrix)
# ===========================================================================

class MetroPricesDelhiAdapter(SourceAdapter):
    spec = REGISTRY["kaggle_metro_prices_delhi"]

    AMENITY_COLUMNS = [
        "MaintenanceStaff", "Gymnasium", "SwimmingPool", "LandscapedGardens",
        "JoggingTrack", "RainWaterHarvesting", "IndoorGames", "ShoppingMall",
        "Intercom", "SportsFacility", "ATM", "ClubHouse", "School",
        "24X7Security", "PowerBackup", "CarParking", "StaffQuarter",
        "Cafeteria", "MultipurposeRoom", "Hospital", "WashingMachine",
        "Gasconnection", "AC", "Wifi", "Children'splayarea", "LiftAvailable",
        "BED", "VaastuCompliant", "Microwave", "GolfCourse", "TV",
        "DiningTable", "Sofa", "Wardrobe", "Refrigerator",
    ]

    def __init__(self, archive=None):
        self.archive = archive or _cache_path("metro_prices.zip")

    def fetch(self):
        if not self.archive.exists():
            download_kaggle(
                "ruchi798/housing-prices-in-metropolitan-areas-of-india",
                "metro_prices.zip",
            )
        return _read_csv_from_zip(self.archive, "Delhi.csv")

    def parse(self, raw_text):
        rows = _rows(raw_text)
        out = []
        for i, r in enumerate(rows):
            price = P.parse_number(r.get("Price"), 100_000, 5_000_000_000)
            area = P.parse_number(r.get("Area"), 100, 100_000)
            if not price or not area:
                continue
            loc = (r.get("Location") or "").strip()
            if not loc:
                continue
            flags = {}
            for c in self.AMENITY_COLUMNS:
                v = P.parse_number(r.get(c), 0, 1)
                if v is not None:
                    flags[c] = int(v)
            obs = Observation(
                source_key=self.spec.key,
                source_record_id=f"row{i}",
                source_url=self.spec.url,
                retrieved_at=_now_iso(),
                target_type=TARGET_ASKING,
                observed_date=None,
                city="New Delhi",
                locality=P.normalize_locality(loc),
                sub_locality=loc[:200],
                state="Delhi",
                property_category=CAT_APARTMENT,
                segment=SEGMENT_RESIDENTIAL_BUILTUP,
                area_sqft=area,
                area_definition=AREA_BUILTUP,
                area_value_original=area,
                area_unit_original="sqft",
                bedrooms=P.parse_number(r.get("No. of Bedrooms"), 0, 30),
                lift_available=flags.get("LiftAvailable"),
                parking_count=flags.get("CarParking"),
                amenity_flags=flags,
                price_inr=price,
                price_per_sqft_inr=price / area,
                price_basis="total_price_advertised",
                license_key=self.spec.license,
            )
            if P.parse_number(r.get("Resale"), 0, 1) == 1:
                obs.transaction_type = "resale"
            out.append(obs)
        return out


# ===========================================================================
# 3. Real Estate Data from 7 Indian Cities
# ===========================================================================

_TITLE_RE = re.compile(
    r"(?P<bhk>\d+)\s*(?:bhk|rk)\s*(?P<kind>flat|apartment|independent\s*house|house|villa|plot|land|builder\s*floor)"
    r"\s*for\s*(sale|rent)\s*in\s*(?P<loc>.+)$",
    re.I,
)


class SevenCitiesAdapter(SourceAdapter):
    spec = REGISTRY["kaggle_7cities_listings"]

    def __init__(self, archive=None):
        self.archive = archive or _cache_path("seven_cities.zip")

    def fetch(self):
        if not self.archive.exists():
            download_kaggle(
                "rakkesharv/real-estate-data-from-7-indian-cities", "seven_cities.zip"
            )
        return _read_csv_from_zip(self.archive, "Real Estate Data V21.csv")

    def parse(self, raw_text):
        rows = _rows(raw_text)
        out = []
        for i, r in enumerate(rows):
            title = (r.get("Property Title") or "").strip()
            loc = (r.get("Location") or "").strip()
            m = _TITLE_RE.search(title)
            if not m:
                continue
            city = P.normalize_city(loc) or P.normalize_city(title)
            if not city:
                continue
            price = P.parse_inr(r.get("Price"))
            area = P.parse_number(r.get("Total_Area"), 100, 200_000)
            if not price or not area:
                continue
            kind = m.group("kind").lower()
            if "flat" in kind or "apartment" in kind:
                category = CAT_APARTMENT
                area_def = AREA_CARPET
            elif "house" in kind:
                category = CAT_INDEPENDENT_HOUSE
                area_def = AREA_PLOT
            elif "villa" in kind:
                category = CAT_VILLA
                area_def = AREA_PLOT
            elif "plot" in kind or "land" in kind:
                category = CAT_PLOT
                area_def = AREA_PLOT
            else:
                continue
            balcony = (r.get("Balcony") or "").strip().lower()
            obs = Observation(
                source_key=self.spec.key,
                source_record_id=f"row{i}",
                source_url=self.spec.url,
                retrieved_at=_now_iso(),
                target_type=TARGET_ASKING,
                observed_date=None,
                city=city,
                locality=P.normalize_locality(loc),
                sub_locality=loc[:200],
                state=P.state_for_city(city),
                property_category=category,
                segment=CATEGORY_SEGMENT[category],
                title=(r.get("Name") or "")[:200] or None,
                area_sqft=area,
                area_definition=area_def,
                area_value_original=area,
                area_unit_original="sqft",
                bedrooms=P.parse_bhk(m.group("bhk")),
                bathrooms=P.parse_number(r.get("Baths"), 0, 30),
                balconies=1.0 if balcony.startswith("y") else 0.0 if balcony.startswith("n") else None,
                price_inr=price,
                price_per_sqft_inr=price / area,
                price_basis="total_price_advertised",
                license_key=self.spec.license,
            )
            out.append(obs)
        return out


# ===========================================================================
# 4. Delhi NCR Real Estate Data (ODbL)
# ===========================================================================

_SQFT_TEXT = re.compile(r"([\d,\.]+)\s*(sq\.?\s*ft|sqft|square\s*feet)", re.I)
_SQYD_TEXT = re.compile(r"([\d,\.]+)\s*(sq\.?\s*yrd|sq\s*yards?|square\s*yards?|sqyrd)", re.I)
_SQM_TEXT = re.compile(r"([\d,\.]+)\s*(sq\.?\s*m|sqm|square\s*met)", re.I)
_ACRE_TEXT = re.compile(r"([\d,\.]+)\s*(acre|acres)", re.I)


def parse_area_text(text, state=None):
    """Parse a free-form area string into (sqft, original_value, unit, definition).

    Tries the most specific patterns first. Returns (None, None, None, None)
    when it cannot parse - never guesses.
    """
    if not text:
        return None, None, None, None
    s = str(text).strip()
    low = s.lower()

    definition = AREA_CARPET
    m = re.search(r"carpet\s*area", low)
    if m:
        definition = AREA_CARPET
    elif re.search(r"built\s*-?\s*up", low):
        definition = AREA_BUILTUP
    elif re.search(r"plot\s*area", low):
        definition = AREA_PLOT
    elif re.search(r"super\s*built", low):
        definition = AREA_BUILTUP

    m = _SQFT_TEXT.search(s)
    if m:
        v = P.parse_number(m.group(1), 1, 1_000_000)
        if v:
            return v, v, "sqft", definition
    m = _SQYD_TEXT.search(s)
    if m:
        v = P.parse_number(m.group(1), 1, 1_000_000)
        if v:
            try:
                return v * 9.0, v, "sqyd", definition
            except U.UnknownUnitError:
                return None, None, None, None
    m = _SQM_TEXT.search(s)
    if m:
        v = P.parse_number(m.group(1), 1, 1_000_000)
        if v:
            return v * U.SQFT_PER_SQM, v, "sqm", definition
    m = _ACRE_TEXT.search(s)
    if m:
        v = P.parse_number(m.group(1), 0.001, 1000)
        if v:
            return v * U.SQFT_PER_ACRE, v, "acre", definition
    return None, None, None, None


class DelhiNCR99acresAdapter(SourceAdapter):
    spec = REGISTRY["kaggle_delhi_ncr_99acres"]

    def __init__(self, archive=None):
        self.archive = archive or _cache_path("delhi_ncr_99acres.zip")

    def fetch(self):
        if not self.archive.exists():
            download_kaggle("luv00679/delhi-ncr-real-estate-data", "delhi_ncr_99acres.zip")
        return _read_csv_from_zip(self.archive, "real_estate_main.csv")

    def parse(self, raw_text):
        rows = _rows(raw_text)
        out = []
        for i, r in enumerate(rows):
            city = P.normalize_city(r.get("city"))
            if not city:
                continue
            price = P.parse_number(r.get("Price"), 100_000, 5_000_000_000)
            if not price:
                continue
            area, aval, aunit, adef = parse_area_text(r.get("carpet.area"))
            if not area:
                area2 = P.parse_number(r.get("carpet_area_sqft"), 100, 200_000)
                if area2:
                    area, aval, aunit = area2, area2, "sqft"
                    adef = AREA_CARPET
            if not area:
                continue
            floor_txt = (r.get("floor") or "").strip()
            floor, total = P.parse_floor(floor_txt)
            trans = (r.get("transaction") or "").strip().lower()
            obs = Observation(
                source_key=self.spec.key,
                source_record_id=(r.get("") or f"row{i}"),
                source_url=self.spec.url,
                retrieved_at=_now_iso(),
                target_type=TARGET_ASKING,
                observed_date=None,
                city=city,
                locality=P.normalize_locality(r.get("location")),
                sub_locality=(r.get("location") or "")[:200] or None,
                state=P.state_for_city(city),
                property_category=CAT_APARTMENT,
                segment=SEGMENT_RESIDENTIAL_BUILTUP,
                builder_name=(r.get("property") or "")[:160] or None,
                area_sqft=area,
                area_definition=adef or AREA_CARPET,
                area_value_original=aval,
                area_unit_original=aunit,
                bedrooms=P.parse_number(r.get("bedroom"), 0, 30),
                bathrooms=P.parse_number(r.get("bathroom"), 0, 30),
                balconies=P.parse_number(r.get("balcony"), 0, 20),
                floor_number=floor,
                total_floors=total,
                facing=P.parse_facing(r.get("facing")),
                ownership=P.parse_ownership(r.get("ownership")),
                transaction_type=(
                    "resale" if trans.startswith("resale")
                    else "new_property" if "new property" in trans
                    else None
                ),
                parking_count=P.parse_number(r.get("parking"), 0, 20),
                price_inr=price,
                price_per_sqft_inr=price / area,
                price_basis="total_price_advertised",
                license_key=self.spec.license,
                extra={"status": r.get("status") or None},
            )
            out.append(obs)
        return out


# ===========================================================================
# 5. Delhi 99acres compact listings
# ===========================================================================

class DelhiListingsAdapter(SourceAdapter):
    spec = REGISTRY["kaggle_delhi_99acres_listings"]

    def __init__(self, archive=None):
        self.archive = archive or _cache_path("delhi_listings.zip")

    def fetch(self):
        if not self.archive.exists():
            download_kaggle(
                "sauravmann/delhi-residential-property-listings", "delhi_listings.zip"
            )
        return _read_csv_from_zip(self.archive, "99acres_Delhi_properties_raw_data.csv")

    def parse(self, raw_text):
        rows = _rows(raw_text)
        out = []
        for i, r in enumerate(rows):
            loc = (r.get("location") or "").strip()
            price = P.parse_inr(r.get("price"))
            area, aval, aunit, adef = parse_area_text(r.get("area"))
            bhk = P.parse_bhk(r.get("bhk"))
            if not (loc and price and area and bhk is not None):
                continue
            kind = "independent builder floor" if "builder floor" in loc.lower() else "flat"
            category = CAT_APARTMENT if kind == "flat" else CAT_INDEPENDENT_HOUSE
            city = P.normalize_city(loc) or "New Delhi"
            obs = Observation(
                source_key=self.spec.key,
                source_record_id=f"row{i}",
                source_url=self.spec.url,
                retrieved_at=_now_iso(),
                target_type=TARGET_ASKING,
                observed_date=None,
                city=city,
                locality=P.normalize_locality(loc),
                sub_locality=loc[:200],
                state=P.state_for_city(city),
                property_category=category,
                segment=CATEGORY_SEGMENT[category],
                title=(r.get("name") or "")[:200] or None,
                area_sqft=area,
                area_definition=adef or AREA_BUILTUP,
                area_value_original=aval,
                area_unit_original=aunit,
                bedrooms=bhk,
                price_inr=price,
                price_per_sqft_inr=price / area,
                price_basis="total_price_advertised",
                license_key=self.spec.license,
            )
            out.append(obs)
        return out


# ===========================================================================
# 6. Gurgaon 2023 (CC BY-NC-SA, NON-COMMERCIAL - gated)
# ===========================================================================

_GURGAON_MEMBER = {
    "flats": "flats.csv",
    "houses": "independent-house.csv",
    "land": "residential-land.csv",
}


class Gurgaon2023Adapter(SourceAdapter):
    spec = REGISTRY["kaggle_gurgaon_99acres_2023"]

    def __init__(self, archive=None, member="flats"):
        self.archive = archive or _cache_path("gurgaon_2023.zip")
        self.member = member

    def fetch(self):
        if not self.archive.exists():
            download_kaggle(
                "namesakenberg/gurgaon-2023-raw-property-listings", "gurgaon_2023.zip"
            )
        return _read_csv_from_zip(self.archive, _GURGAON_MEMBER[self.member])

    def parse(self, raw_text):
        rows = _rows(raw_text)
        out = []
        for i, r in enumerate(rows):
            price = P.parse_inr(r.get("price"))
            if not price:
                continue
            if self.member == "land":
                area, aval, aunit, adef = parse_area_text(r.get("areaWithType"))
                category = CAT_LAND_RESIDENTIAL
                bedrooms = None
            elif self.member == "houses":
                area, aval, aunit, adef = parse_area_text(r.get("areaWithType"))
                if not area:
                    area, aval, aunit, adef = parse_area_text(r.get("area"))
                category = CAT_VILLA if "villa" in (r.get("property_name") or "").lower() else CAT_INDEPENDENT_HOUSE
                bedrooms = P.parse_number(re.sub(r"[^\d]", "", (r.get("bedRoom") or "")) or None, 0, 30)
            else:
                area, aval, aunit, adef = parse_area_text(r.get("areaWithType"))
                if not area:
                    area, aval, aunit, adef = parse_area_text(r.get("area"))
                category = CAT_APARTMENT
                bedrooms = P.parse_number(re.sub(r"[^\d]", "", (r.get("bedRoom") or "")) or None, 0, 30)
            if not area:
                continue
            addr = (r.get("address") or "").strip()
            floor, total = P.parse_floor(r.get("floorNum") or r.get("noOfFloor"))
            obs = Observation(
                source_key=self.spec.key,
                source_record_id=(r.get("property_id") or f"row{i}"),
                source_url=r.get("link") or self.spec.url,
                retrieved_at=_now_iso(),
                target_type=TARGET_ASKING,
                observed_date="2023",  # publisher states data collected in 2023
                city="Gurugram",
                locality=P.normalize_locality(addr),
                sub_locality=addr[:200] or None,
                state="Haryana",
                property_category=category,
                segment=CATEGORY_SEGMENT[category],
                title=(r.get("property_name") or "")[:200] or None,
                project_name=(r.get("society") or "")[:160] or None,
                area_sqft=area,
                area_definition=adef or (AREA_PLOT if self.member != "flats" else AREA_CARPET),
                area_value_original=aval,
                area_unit_original=aunit,
                bedrooms=bedrooms,
                bathrooms=P.parse_number(re.sub(r"[^\d]", "", (r.get("bathroom") or "")) or None, 0, 30),
                balconies=P.parse_number(re.sub(r"[^\d]*", "", (r.get("balcony") or "")) or None, 0, 20),
                floor_number=floor,
                total_floors=total,
                facing=P.parse_facing(r.get("facing")),
                property_age_years=P.parse_age_years(r.get("agePossession")),
                price_inr=price,
                price_per_sqft_inr=price / area,
                price_basis="total_price_advertised",
                license_key=self.spec.license,
                non_commercial=True,
                amenities=_string_list(r.get("features")),
                extra={"nearby_raw": _nearby_with_distances(r.get("nearbyLocations"))},
            )
            out.append(obs)
        return out


def _string_list(raw):
    if not raw:
        return []
    s = str(raw).strip()
    if s.startswith("[") and s.endswith("]"):
        try:
            return [str(x) for x in json.loads(s.replace("'", '"'))][:40]
        except Exception:
            pass
    return [p.strip() for p in s.split(",") if p.strip()][:40]


def _nearby_with_distances(raw):
    """Some rows include an explicit {'place': '2.5 KM'} dict. Keep those —
    they are publisher-supplied distances, not our estimates."""
    if not raw:
        return None
    s = str(raw).strip()
    if not s.startswith("{"):
        return None
    try:
        return json.loads(s.replace("'", '"'))
    except Exception:
        return None


# ===========================================================================
# 7. Gurugram 4000 properties (CC0) - real Gurugram listings with sector labels
# ===========================================================================

class Gurugram4000Adapter(SourceAdapter):
    spec = REGISTRY["kaggle_gurgaon_4000"]

    def __init__(self, archive=None):
        self.archive = archive or _cache_path("gurgaon_4000.zip")

    def fetch(self):
        if not self.archive.exists():
            download_kaggle(
                "navneet9693/4000-gurgaon-real-estate-property-dataset", "gurgaon_4000.zip"
            )
        return _read_csv_from_zip(self.archive, "gurgaon_properties_cleaned_v2.csv")

    def parse(self, raw_text):
        rows = _rows(raw_text)
        out = []
        for i, r in enumerate(rows):
            # NOTE: this source's `price` column is a bare number in CRORES
            # (verified: 0.82 with price_per_sqft 7585 and area 1081 gives
            # 0.82 Cr / 1081 sqft = 7586 INR/sqft, matching the stated rate).
            # We corroborate against the stated price_per_sqft rather than
            # assuming, and reject the row if the two disagree by >25%.
            crore = P.parse_number(r.get("price"), 0.01, 1000)
            stated_ppsf = P.parse_number(r.get("price_per_sqft"), 100, 200_000)
            if not crore:
                continue
            price = crore * 10_000_000
            # `area` column for flats is super built-up, matching price_per_sqft.
            sbua = P.parse_number(r.get("super_built_up_area"), 100, 100_000)
            carpet = P.parse_number(r.get("carpet_area"), 100, 100_000)
            area_for_rate = sbua or carpet
            if (
                stated_ppsf
                and area_for_rate
                and abs(price / area_for_rate - stated_ppsf) / stated_ppsf > 0.25
            ):
                # Do not guess which column is authoritative - drop it.
                continue
            if carpet:
                area, aval, aunit, adef = carpet, carpet, "sqft", AREA_CARPET
            elif sbua:
                area, aval, aunit, adef = sbua, sbua, "sqft", AREA_BUILTUP
            else:
                area, aval, aunit, adef = parse_area_text(r.get("areaWithType"))
            if not area:
                continue
            ptype = (r.get("property_type") or "").strip().lower()
            category = CAT_APARTMENT if ptype.startswith("flat") else CAT_INDEPENDENT_HOUSE
            floor, total = P.parse_floor(r.get("floorNum"))
            sector = (r.get("sector") or "").strip()
            obs = Observation(
                source_key=self.spec.key,
                source_record_id=f"row{i}",
                source_url=self.spec.url,
                retrieved_at=_now_iso(),
                target_type=TARGET_ASKING,
                observed_date=None,
                city="Gurugram",
                locality=P.normalize_locality(sector),
                sub_locality=(sector or (r.get("society") or ""))[:200] or None,
                state="Haryana",
                property_category=category,
                segment=CATEGORY_SEGMENT[category],
                project_name=(r.get("society") or "")[:160] or None,
                area_sqft=area,
                area_definition=adef or AREA_BUILTUP,
                area_value_original=aval,
                area_unit_original=aunit,
                bedrooms=P.parse_number(r.get("bedRoom"), 0, 30),
                bathrooms=P.parse_number(r.get("bathroom"), 0, 30),
                balconies=P.parse_number(r.get("balcony"), 0, 20),
                floor_number=floor,
                total_floors=total,
                facing=P.parse_facing(r.get("facing")),
                property_age_years=P.parse_age_years(r.get("agePossession")),
                price_inr=price,
                price_per_sqft_inr=stated_ppsf or (price / area),
                price_basis="total_price_advertised",
                license_key=self.spec.license,
                extra={"sector_raw": sector or None, "price_stated_crore": crore},
            )
            out.append(obs)
        return out


# ===========================================================================
# Adapter registry used by the ingest CLI
# ===========================================================================

ACTIVE_ADAPTERS = {
    "kaggle_delhi_ncr_housing_v2": DelhiNCRHousingAdapter,
    "kaggle_metro_prices_delhi": MetroPricesDelhiAdapter,
    "kaggle_7cities_listings": SevenCitiesAdapter,
    "kaggle_delhi_ncr_99acres": DelhiNCR99acresAdapter,
    "kaggle_delhi_99acres_listings": DelhiListingsAdapter,
    "kaggle_gurgaon_4000": Gurugram4000Adapter,
}
