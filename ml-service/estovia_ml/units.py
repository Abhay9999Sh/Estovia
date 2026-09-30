"""Indian land-area unit conversion.

Conversion factors are keyed by REGION because a bigha is not a single
quantity in India. We only ship factors we can cite, and each factor carries
a `source` string so the pipeline can record provenance rather than silently
assuming a national conversion.

Canonical unit is square feet.
"""

from dataclasses import dataclass, field

SQFT_PER_SQM = 10.7639104167097
SQFT_PER_ACRE = 43560.0
SQFT_PER_HECTARE = 107639.104167097


@dataclass(frozen=True)
class UnitFactor:
    unit: str
    sqft: float
    region: str
    source: str


# Regional units we will not guess at. `sqft=None` means "not configured".
UNIT_FACTORS = [
    UnitFactor("sqft", 1.0, "all", "canonical unit"),
    UnitFactor("sqm", SQFT_PER_SQM, "all", "SI definition: 1 m = 3.280839895 ft"),
    UnitFactor("sqft_", 1.0, "all", "canonical unit"),
    UnitFactor("sqyd", 9.0, "all", "international yard = 3 ft"),
    UnitFactor("sq_yd", 9.0, "all", "international yard = 3 ft"),
    UnitFactor("acre", SQFT_PER_ACRE, "all", "international acre = 43,560 ft2"),
    UnitFactor("hectare", SQFT_PER_HECTARE, "all", "1 ha = 10,000 m2"),
    UnitFactor(
        "sqkm",
        SQFT_PER_SQM * 1_000_000,
        "all",
        "SI definition",
    ),
    # ---- Regional land units -------------------------------------------------
    # Haryana (Gurugram, Faridabad, Noida-adjacent): Punjab/Uttarakhand/Haryana
    # standard bigha/bisi.
    UnitFactor(
        "bigha_hr",
        27225.0,
        "haryana",
        "Haryana revenue convention: 1 bigha (bisi) = 27,225 sq ft = 2,529.29 m2",
    ),
    UnitFactor(
        "kantha_hr",
        5445.0,
        "haryana",
        "Haryana: 1 kana = 1/5 bigha = 5,445 sq ft",
    ),
    UnitFactor(
        "biswa_hr",
        2722.5,
        "haryana",
        "Haryana: 1 biswa = 1/10 bigha = 2,722.5 sq ft",
    ),
    # Uttar Pradesh (Noida, Ghaziabad, Lucknow belt): 1 bigha = 27,000 sq ft.
    UnitFactor(
        "bigha_up",
        27000.0,
        "uttar_pradesh",
        "UP revenue convention: 1 bigha = 27,000 sq ft = 2,509.63 m2",
    ),
    UnitFactor(
        "biswa_up",
        2700.0,
        "uttar_pradesh",
        "UP: 1 biswa = 1/10 bigha = 2,700 sq ft",
    ),
    UnitFactor(
        "guntha",
        1089.0,
        "maharashtra",
        "Maharashtra: 1 guntha = 1,089 sq ft = 108.9 m2",
    ),
    # Marla: 225 sq ft (Punjab/Haryana/Rajasthan usage).
    UnitFactor("marla", 225.0, "north_india", "1 marla = 272.25 m2 / 225 sq ft (approx. standard)"),
]

# Generic token -> unit key, so free-form source strings can be parsed.
ALIASES = {
    "sqft": "sqft",
    "sq.ft": "sqft",
    "sq ft": "sqft",
    "square feet": "sqft",
    "sqfeet": "sqft",
    "sqm": "sqm",
    "sq.m": "sqm",
    "sq m": "sqm",
    "square meter": "sqm",
    "sqm.": "sqm",
    "sqyd": "sqyd",
    "sq yard": "sqyd",
    "sqyards": "sqyd",
    "square yard": "sqyd",
    "sqyrd": "sqyd",
    "yrd": "sqyd",
    "acre": "acre",
    "acres": "acre",
    "hectare": "hectare",
    "hect": "hectare",
    "sqkm": "sqkm",
    "bigha": "bigha_hr",
    "bigah": "bigha_hr",
    "bigha_hr": "bigha_hr",
    "bigha_up": "bigha_up",
    "kana": "kantha_hr",
    "kantha": "kantha_hr",
    "biswa": "biswa_hr",
    "guntha": "guntha",
    "marla": "marla",
}


class UnknownUnitError(ValueError):
    pass


def resolve(unit_token, state=None):
    """Resolve a unit token (optionally disambiguated by state) to a factor.

    Bare `bigha` is state-dependent. We only accept it when `state` maps to a
    region we have a cited factor for, otherwise we refuse rather than guess.
    """
    if unit_token is None:
        raise UnknownUnitError("missing unit")
    key = str(unit_token).strip().lower().replace("  ", " ")
    key = ALIASES.get(key, key)
    if key not in {f.unit for f in UNIT_FACTORS}:
        raise UnknownUnitError(f"unit not configured: {unit_token!r}")
    if key == "bigha_hr":
        region = (state or "").strip().lower()
        if region in {"uttar pradesh", "uttarakhand", "up", "uk"}:
            return unit_factor("bigha_up")
        if region in {"maharashtra", "mh"}:
            raise UnknownUnitError(
                "bigha in Maharashtra is context dependent; supply biswa or guntha"
            )
        if region not in {"haryana", "hr", "punjab", "pb", "rajasthan", "rj", "delhi", "dl"}:
            raise UnknownUnitError(
                f"bare 'bigha' is not resolvable for state={state!r}; "
                "use an explicit regional unit"
            )
    return unit_factor(key)


def unit_factor(unit_key):
    for f in UNIT_FACTORS:
        if f.unit == unit_key:
            return f
    raise UnknownUnitError(unit_key)


def to_sqft(value, unit_token, state=None):
    factor = resolve(unit_token, state=state)
    return float(value) * factor.sqft


def from_sqft(sqft, unit_key):
    return float(sqft) / unit_factor(unit_key).sqft


def describe():
    """Machine-readable factor table, for documentation/audit output."""
    return [
        {
            "unit": f.unit,
            "region": f.region,
            "sqft": f.sqft,
            "source": f.source,
        }
        for f in UNIT_FACTORS
    ]
