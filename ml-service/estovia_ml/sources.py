"""Source registry + adapter interface.

Every adapter must declare:
  key                 stable identifier used in provenance records
  name                human readable
  url                 official / canonical URL
  target_type         'asking_price' | 'transaction_price' | 'guidance_value'
  license             licence string as stated by the publisher
  commercial_use      bool - may we use this for a commercial product?
  attribution         required attribution text
  access_method       how we obtain it

Adapters return `RawRecord` dicts. They MUST NOT invent values: if a field is
absent in the source it stays None. Adapters are also the only place allowed
to convert a source-specific field name to our canonical schema, and every
record carries `source_key`, `source_record_id`, `source_url`,
`observed_date` (when the source exposes one) and `retrieved_at`.
"""

from dataclasses import dataclass, field
from typing import Any


TARGET_ASKING = "asking_price"
TARGET_TRANSACTION = "transaction_price"
TARGET_GUIDANCE = "guidance_value"
TARGET_GEOSPATIAL = "geospatial"


@dataclass
class SourceSpec:
    key: str
    name: str
    url: str
    target_type: str
    license: str
    commercial_use: bool
    attribution: str
    access_method: str
    geography: str = ""
    time_coverage: str = ""
    notes: str = ""


@dataclass
class RawRecord:
    source_key: str
    source_record_id: str
    source_url: str
    observed_date: str | None
    target_type: str
    payload: dict[str, Any]
    retrieved_at: str
    extra: dict[str, Any] = field(default_factory=dict)


class SourceAdapter:
    """Base class. Subclasses implement `fetch()` and `parse()`."""

    spec: SourceSpec

    def fetch(self):  # pragma: no cover - network dependent
        raise NotImplementedError

    def parse(self, raw):  # pragma: no cover
        raise NotImplementedError

    def run(self):
        return self.parse(self.fetch())


# ---------------------------------------------------------------------------
# Registry of every source we investigated, including ones we could NOT use.
# Keeping the rejected ones in code (not just prose) prevents someone later
# "fixing" the pipeline by pointing at a source we proved unusable.
# ---------------------------------------------------------------------------

REGISTRY: dict[str, SourceSpec] = {}


def register(spec: SourceSpec) -> SourceSpec:
    REGISTRY[spec.key] = spec
    return spec


def _register_all():
    register(
        SourceSpec(
            key="kaggle_delhi_ncr_housing_v2",
            name="Housing Price Dataset of Delhi (Delhi_v2.csv)",
            url="https://www.kaggle.com/datasets/goelyash/housing-price-dataset-of-delhiindia",
            target_type=TARGET_ASKING,
            license="CC0 1.0 Public Domain",
            commercial_use=True,
            attribution="Housing Price Dataset of Delhi, Kaggle (CC0)",
            access_method="Kaggle public dataset download API (no credentials required)",
            geography="Delhi NCR - Delhi, Ghaziabad, Gurugram, Noida, Greater Noida, Faridabad",
            time_coverage="observation date not published by the dataset; not asserted",
            notes=(
                "Advertised asking prices. Carries latitude/longitude for every row, "
                "which is why this is the backbone of the geospatial feature build."
            ),
        )
    )
    register(
        SourceSpec(
            key="kaggle_metro_prices_delhi",
            name="Housing Prices in Metropolitan Areas of India - Delhi.csv",
            url="https://www.kaggle.com/datasets/ruchi798/housing-prices-in-metropolitan-areas-of-india",
            target_type=TARGET_ASKING,
            license="CC0 1.0 Public Domain",
            commercial_use=True,
            attribution="Housing Prices in Metropolitan Areas of India, Kaggle (CC0)",
            access_method="Kaggle public dataset download API",
            geography="Delhi (metropolitan)",
            time_coverage="not published",
            notes="Rich amenity flag matrix (38 binary amenity columns) and locality labels.",
        )
    )
    register(
        SourceSpec(
            key="kaggle_7cities_listings",
            name="Real Estate Data from 7 Indian Cities",
            url="https://www.kaggle.com/datasets/rakkesharv/real-estate-data-from-7-indian-cities",
            target_type=TARGET_ASKING,
            license="CC0 1.0 Public Domain",
            commercial_use=True,
            attribution="Real Estate Data from 7 Indian Cities, Kaggle (CC0)",
            access_method="Kaggle public dataset download API",
            geography="Bangalore, Chennai, Delhi, Hyderabad, Kolkata, Mumbai, Pune",
            time_coverage="not published",
            notes="Only Delhi NCR rows are ingested; other cities are out of model scope.",
        )
    )
    register(
        SourceSpec(
            key="kaggle_delhi_ncr_99acres",
            name="Delhi NCR Real Estate Data (ODbL)",
            url="https://www.kaggle.com/datasets/luv00679/delhi-ncr-real-estate-data",
            target_type=TARGET_ASKING,
            license="ODbL 1.0",
            commercial_use=True,
            attribution="Delhi NCR Real Estate Data, Kaggle, ODbL 1.0",
            access_method="Kaggle public dataset download API",
            geography="Delhi, Gurugram",
            time_coverage="not published",
            notes="Contains carpet area, floor, transaction type, ownership type.",
        )
    )
    register(
        SourceSpec(
            key="kaggle_delhi_99acres_listings",
            name="Delhi Residential Property Listings (99acres raw)",
            url="https://www.kaggle.com/datasets/sauravmann/delhi-residential-property-listings",
            target_type=TARGET_ASKING,
            license="CC0 1.0 Public Domain",
            commercial_use=True,
            attribution="Delhi Residential Property Listings, Kaggle (CC0)",
            access_method="Kaggle public dataset download API",
            geography="Delhi",
            time_coverage="not published",
            notes="Compact: name/location/price/area/bhk.",
        )
    )
    register(
        SourceSpec(
            key="kaggle_gurgaon_99acres_2023",
            name="Gurgaon Real Estate Dataset (2023)",
            url="https://www.kaggle.com/datasets/namesakenberg/gurgaon-2023-raw-property-listings",
            target_type=TARGET_ASKING,
            license="CC BY-NC-SA 4.0",
            commercial_use=False,
            attribution="Gurgaon Real Estate Dataset (2023), CampusX DSMP 2023, CC BY-NC-SA 4.0",
            access_method="Kaggle public dataset download API",
            geography="Gurugram, Haryana",
            time_coverage="2023 (stated by publisher)",
            notes=(
                "NON-COMMERCIAL. Publisher README states redistribution and commercial "
                "use are not allowed. Ingested for research/evaluation only; gated "
                "behind ESTOVIA_ALLOW_NONCOMMERCIAL_SOURCES."
            ),
        )
    )
    register(
        SourceSpec(
            key="kaggle_gurgaon_4000",
            name="4000 Gurugram Real Estate Property Dataset",
            url="https://www.kaggle.com/datasets/navneet9693/4000-gurgaon-real-estate-property-dataset",
            target_type=TARGET_ASKING,
            license="CC0 1.0 Public Domain",
            commercial_use=True,
            attribution="4000 Gurugram Real Estate Property Dataset, Kaggle (CC0)",
            access_method="Kaggle public dataset download API",
            geography="Gurugram, Haryana",
            time_coverage="not published",
            notes="Carries explicit sector labels, carpet and super built-up areas.",
        )
    )
    register(
        SourceSpec(
            key="osm_overpass",
            name="OpenStreetMap via Overpass API",
            url="https://overpass-api.de/api/interpreter",
            target_type=TARGET_GEOSPATIAL,
            license="ODbL 1.0",
            commercial_use=True,
            attribution="© OpenStreetMap contributors, ODbL 1.0",
            access_method="Overpass QL over HTTPS",
            geography="Delhi NCR tiles fetched on demand",
            time_coverage="live at retrieval; retrieved_at recorded per feature set",
            notes=(
                "Used ONLY for accessibility features (metro/school/hospital/park/mall "
                "proximity). Presence of a POI is not treated as a quality signal."
            ),
        )
    )

    # --- Investigated and REJECTED. Kept so they are not silently re-added. ---
    for key, name, url, why in [
        (
            "kaggle_india_re_intelligence_2025",
            "India Real Estate Intelligence Dataset 2025-2026",
            "https://www.kaggle.com/datasets/kuldeepjangra/india-real-estate-intelligence-dataset-20252026",
            "SYNTHETIC. Downloaded and inspected: developer names follow the pattern "
            "'Urban Builders <n>', buyer_type values include 'Trust', bank_name='Mixed', "
            "registration numbers are sequential REG<digits>, cities named "
            "'Bihar City 125'/'Lakshadweep'. Not real market data.",
        ),
        (
            "kaggle_house_price_of_india_afsal",
            "House Price dataset of India",
            "https://www.kaggle.com/datasets/mohamedafsal007/house-price-dataset-of-india",
            "MISLABELLED. File headers are Ames/Iowa Housing; lat/lon 52.88/-114.47 "
            "(Edmonton, Alberta); price in USD. Not Indian data.",
        ),
        (
            "kaggle_house_prices_india_brar",
            "House Prices India",
            "https://www.kaggle.com/datasets/sukhmandeepsinghbrar/house-prices-india",
            "MISLABELLED. Same Ames/Iowa content as above.",
        ),
        (
            "kaggle_delhi_ncr_2025_synthetic",
            "Delhi NCR Housing Dataset (2025)",
            "https://www.kaggle.com/datasets/aabhas2351/delhi-ncr-housing-dataset-2025",
            "SYNTHETIC. area_sqft is the constant 1400 and bhk the constant 3 across "
            "all 12,000 rows in both raw and cleaned files.",
        ),
        (
            "kaggle_indian_realestate_2023_25",
            "Indian Real Estate Market Dataset 2023-25",
            "https://www.kaggle.com/datasets/shambhurajejagadale/indian-real-estate-market-dataset-2023-25",
            "SYNTHETIC / no provenance. Single file literally named "
            "'indian_realestate_dataset_1000.csv' with exactly 1,000 rows and no "
            "publisher provenance.",
        ),
        (
            "ogd_api_data_gov_in",
            "Open Government Data Platform India (api.data.gov.in)",
            "https://api.data.gov.in/catalog/v1",
            "UNREACHABLE. Tested 2026-09-29: catalog returns HTTP 400 "
            "'Authorization field missing' without a key, HTTP 503 intermittently, and "
            "HTTP 403 'Key not authorised' for the widely published demo key "
            "579b464db66ec23bdd0000017d0wnload. www.data.gov.in renders "
            "'No records found' and a maintenance banner. Requires a self-registered key.",
        ),
        (
            "gujarat_ogd_property_sales",
            "Gujarat OGD property sale transactions",
            "https://gujarat.data.gov.in/",
            "UNREACHABLE. NXDOMAIN from two independent resolvers; no API could be verified.",
        ),
        (
            "maharashtra_bhulekh",
            "Maharashtra Bhulekh / IGRS",
            "https://bhulekh.igrs.maharashtra.gov.in/",
            "UNREACHABLE. NXDOMAIN. Likely geo-fenced DNS rather than removal.",
        ),
        (
            "telangana_ts_bhoomi",
            "Telangana TS-bhoomi",
            "https://tsbhoomi.telangana.gov.in/",
            "UNREACHABLE. NXDOMAIN.",
        ),
        (
            "delhi_ilr",
            "Delhi ILR / revenue land records",
            "https://dlilr.delhi.gov.in/",
            "UNREACHABLE. NXDOMAIN. revenue.delhi.gov.in loads but publishes circle-rate "
            "notifications as PDF notices with captcha-gated per-property search; no "
            "machine-readable feed verified.",
        ),
        (
            "haryana_jamabandi_igrl",
            "Haryana WEB-HALRIS IGLR transactions",
            "https://jamabandi.nic.in/",
            "PARTIAL. Site intermittently reachable (200 then connection timeouts). "
            "IGLR 'Integrated property wise transaction details' is real registered-sale "
            "data and appears to be queryable without login, but it is a per-property "
            "interactive captcha search, not a bulk feed. Not usable for automated "
            "ingestion, and CAPTCHA bypass is out of scope by policy.",
        ),
        (
            "up_igrs",
            "Uttar Pradesh IGRS registration",
            "https://igrsup.gov.in/",
            "PARTIAL. Landing page reachable; per-deed search is captcha/manual. "
            "No public API verified.",
        ),
        (
            "magicbricks",
            "MagicBricks",
            "https://www.magicbricks.com/",
            "NO PUBLIC API. Root reachable; no documented API or data-licensing product "
            "for third parties. Scraping is prohibited by their terms and by our policy.",
        ),
        (
            "99acres",
            "99acres",
            "https://www.99acres.com/",
            "NO PUBLIC API. Returns HTTP 403 to non-browser clients. Third-party "
            "documentation states 99acres offers no public API and publishes no feed "
            "downloads.",
        ),
        (
            "housing_com",
            "Housing.com",
            "https://www.housing.com/",
            "NO PUBLIC API. Returns HTTP 406 to non-browser clients; no public API "
            "documentation found.",
        ),
        (
            "nominatim",
            "Nominatim geocoding",
            "https://nominatim.openstreetmap.org/",
            "POLICY-PERMITTED BUT NOT USED. Reachable, however the usage policy forbids "
            "systematic/bulk querying and use in some automated pipelines. Estovia uses "
            "coordinates already stored on its own listings instead.",
        ),
        (
            "openrouteservice",
            "OpenRouteService",
            "https://api.openrouteservice.org/",
            "KEY REQUIRED. Reachable; /v2/directions returns HTTP 401 without a key. "
            "Free tier documented at roughly 7,000 requests/day. Adapter left in place "
            "for travel-time features when ESTOVIA_OPENROUTESERVICE_KEY is supplied.",
        ),
        (
            "nhb_housing_price_index",
            "NHB Housing Price Index",
            "https://nhb.org.in/data-graphs",
            "CITY-LEVEL INDEX ONLY. Reachable (HTTP 200) and free to view, but publishes "
            "a quarterly city-level index, not per-property values. Cannot support a "
            "property-level target.",
        ),
    ]:
        register(
            SourceSpec(
                key=key,
                name=name,
                url=url,
                target_type=TARGET_ASKING,
                license="n/a",
                commercial_use=False,
                attribution="",
                access_method="investigated",
                notes=why,
            )
        )


_register_all()


def accepted_keys():
    return [
        k
        for k, s in REGISTRY.items()
        if s.access_method != "investigated" and s.target_type in (TARGET_ASKING, TARGET_GEOSPATIAL)
    ]


def rejected():
    return {k: s for k, s in REGISTRY.items() if s.access_method == "investigated"}


def registry_rows():
    return [
        {
            "key": s.key,
            "name": s.name,
            "url": s.url,
            "target_type": s.target_type,
            "geography": s.geography,
            "access_method": s.access_method,
            "license": s.license,
            "commercial_use": s.commercial_use,
            "status": "rejected" if s.access_method == "investigated" else "active",
            "notes": s.notes,
        }
        for s in REGISTRY.values()
    ]
