"""Indian price / number parsing.

Prices in these sources arrive as '₹1.99 Cr', '45 Lac', '2.63 Cr',
'85,000,000', '₹ 5,000/sq.ft.'. Parsing must never be lenient about a value
it does not understand: `parse_inr` returns None rather than guessing, because
a wrong price is worse than a missing one.
"""

import re

CRORE = 10_000_000
LAC = 100_000
LAKH = 100_000

_NUM = r"(?:\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)"


def parse_inr(text):
    """Parse an Indian-formatted money string to a float INR amount.

    Returns None when it cannot parse confidently.
    """
    if text is None:
        return None
    if isinstance(text, (int, float)):
        v = float(text)
        return v if v > 0 else None

    s = str(text).strip().lower()
    if not s:
        return None

    # Strip currency symbols, 'rs', 'inr', and whitespace/nbsp.
    s = s.replace("₹", " ").replace("rs.", " ").replace("rs", " ").replace("inr", " ")
    s = s.replace(" ", " ").replace(",", "")
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return None

    m = re.search(_NUM, s)
    if not m:
        return None
    value = float(m.group(0).replace(",", ""))

    tail = s[m.end():].strip()
    if re.search(r"\bcr(or(e)?)?\b", tail):
        return value * CRORE
    if re.search(r"\blakh\b|\blac\b|\blks\b", tail):
        return value * LAC
    if re.search(r"\bk\b", tail):
        return value * 1000
    return value


def parse_number(text, minimum=None, maximum=None):
    """First numeric token in `text`, optionally range-checked."""
    if text is None:
        return None
    if isinstance(text, (int, float)):
        v = float(text)
    else:
        s = str(text).strip().replace(",", "")
        m = re.search(r"-?\d+(?:\.\d+)?", s)
        if not m:
            return None
        v = float(m.group(0))
    if minimum is not None and v < minimum:
        return None
    if maximum is not None and v > maximum:
        return None
    return v


def parse_bhk(text):
    """'3 BHK' / '3 bhk bedroom' / 3.0 -> 3.0"""
    if text is None:
        return None
    if isinstance(text, (int, float)):
        v = float(text)
        return v if 0 <= v <= 30 else None
    m = re.search(r"(\d+)\s*(?:bhk|bed\s*room)", str(text).lower())
    if m:
        v = float(m.group(1))
        return v if 0 <= v <= 30 else None
    m = re.match(r"^\s*(\d+)\b", str(text).strip())
    if m:
        v = float(m.group(1))
        return v if 0 <= v <= 30 else None
    return None


_BHK_MAP = {
    "studio": 0.0,
    "1 bhk": 1.0,
    "2 bhk": 2.0,
    "3 bhk": 3.0,
    "4 bhk": 4.0,
    "5 bhk": 5.0,
    "6 bhk": 6.0,
    "penthouse": 4.0,
    "villa": 4.0,
}


def bhk_label_to_count(label):
    if not label:
        return None
    s = str(label).strip().lower()
    return _BHK_MAP.get(s)


def parse_floor(text):
    """'4th of 12 Floors' -> (4, 12). 'Ground of 4' -> (0, 4)."""
    if text is None:
        return None, None
    s = str(text).strip().lower()
    floor = total = None
    fm = re.search(r"(\d+)\s*(?:st|nd|rd|th)?\s*(?:of|/)\s*(\d+)", s)
    if fm:
        floor, total = float(fm.group(1)), float(fm.group(2))
    elif re.search(r"\bground\b", s):
        floor = 0.0
        tm = re.search(r"(?:of|/)\s*(\d+)", s)
        if tm:
            total = float(tm.group(1))
    else:
        n = parse_number(s, 0, 90)
        if n is not None:
            floor = n
    return floor, total


_AGE_MAP = [
    (r"\b0\s*to\s*1\b|new|brand\s*new|recently", 0.5),
    (r"\b1\s*to\s*5\b|\b1\s*-\s*5\b", 3.0),
    (r"\b5\s*to\s*10\b|\b5\s*-\s*10\b", 7.5),
    (r"\b10\s*to\s*15\b|\b10\s*-\s*15\b", 12.5),
    (r"\b15\s*to\s*20\b|\b15\s*-\s*20\b", 17.5),
    (r"\b20\s*\+|\b20\s*and\s*above\b|\b25\s*\+", 22.0),
]


def parse_age_years(text):
    if text is None:
        return None
    if isinstance(text, (int, float)):
        v = float(text)
        return v if 0 <= v <= 120 else None
    s = str(text).strip().lower()
    for pattern, mid in _AGE_MAP:
        if re.search(pattern, s):
            return mid
    n = parse_number(s, 0, 120)
    return n


_FURNISH_MAP = {
    "fully furnished": "furnished",
    "fully-furnished": "furnished",
    "furnished": "furnished",
    "semi furnished": "semi_furnished",
    "semi-furnished": "semi_furnished",
    "semifurnished": "semi_furnished",
    "unfurnished": "unfurnished",
}


def parse_furnishing(text):
    if not text:
        return None
    s = str(text).strip().lower()
    for k, v in _FURNISH_MAP.items():
        if k in s:
            return v
    return None


_OWNERSHIP_MAP = {
    "freehold": "freehold",
    "free hold": "freehold",
    "leasehold": "leasehold",
    "lease hold": "leasehold",
}


def parse_ownership(text):
    if not text:
        return None
    s = str(text).strip().lower()
    for k, v in _OWNERSHIP_MAP.items():
        if k in s:
            return v
    return None


_FACING_MAP = {
    "north": "north",
    "south": "south",
    "east": "east",
    "west": "west",
    "north-east": "north_east",
    "north east": "north_east",
    "northeast": "north_east",
    "north-west": "north_west",
    "north west": "north_west",
    "northwest": "north_west",
    "south-east": "south_east",
    "south east": "south_east",
    "southeast": "south_east",
    "south-west": "south_west",
    "south west": "south_west",
    "southwest": "south_west",
}


def parse_facing(text):
    if not text:
        return None
    s = str(text).strip().lower()
    for k, v in _FACING_MAP.items():
        if k in s:
            return v
    return None


# --- Locality / city normalisation -----------------------------------------

NCR_CITY_ALIASES = {
    "new delhi - west": "New Delhi",
    "new delhi - south": "New Delhi",
    "new delhi - east": "New Delhi",
    "new delhi - dwarka": "New Delhi",
    "new delhi - rohini": "New Delhi",
    "new delhi - north": "New Delhi",
    "new delhi - central": "New Delhi",
    "new delhi": "New Delhi",
    "delhi": "New Delhi",
    "delhi ncr": "New Delhi",
    "south delhi": "New Delhi",
    "north delhi": "New Delhi",
    "east delhi": "New Delhi",
    "west delhi": "New Delhi",
    "dwarka": "New Delhi",
    "gurgaon": "Gurugram",
    "gurugram": "Gurugram",
    "gurugram city": "Gurugram",
    "gurgaon city": "Gurugram",
    "noida": "Noida",
    "greater noida": "Greater Noida",
    "greater noida west": "Greater Noida",
    "ghaziabad": "Ghaziabad",
    "indirapuram": "Ghaziabad",
    "faridabad": "Faridabad",
    "noida extension": "Noida",
}

NCR_CITIES = {"New Delhi", "Gurugram", "Noida", "Greater Noida", "Ghaziabad", "Faridabad"}

CITY_STATE = {
    "New Delhi": "Delhi",
    "Gurugram": "Haryana",
    "Noida": "Uttar Pradesh",
    "Greater Noida": "Uttar Pradesh",
    "Ghaziabad": "Uttar Pradesh",
    "Faridabad": "Haryana",
}


def normalize_city(text):
    """Resolve an NCR city from free text.

    Addresses look like 'Sector 37D, Gurgaon, Delhi NCR', so we try the whole
    string first and then each comma-separated segment, most specific last.
    """
    if not text:
        return None
    raw = re.sub(r"\s+", " ", str(text).strip().lower())
    if not raw:
        return None
    segments = [s.strip() for s in raw.split(",") if s.strip()]
    # 'Delhi NCR' is the metro region, not a city - use it only as a last resort
    # so 'Sector 37D, Gurgaon, Delhi NCR' resolves to Gurugram, not New Delhi.
    fallback = None
    for seg in segments:
        if seg in NCR_CITY_ALIASES:
            canonical = NCR_CITY_ALIASES[seg]
            if canonical == "New Delhi" and seg in ("delhi ncr", "delhi"):
                fallback = fallback or canonical
                continue
            return canonical
    if fallback:
        return fallback
    # 'Sector 37D Gurgaon' style, no commas.
    for alias, canonical in NCR_CITY_ALIASES.items():
        if re.search(rf"(^|[\s,])({re.escape(alias)})($|[\s,])", raw):
            return canonical
    return None


def state_for_city(city):
    return CITY_STATE.get(city)


_SECTOR_RE = re.compile(r"\bsector[\s\-_]*([0-9]{1,3}[a-z]?)\b", re.I)
_PHASE_RE = re.compile(r"\bphase[\s\-_]*([0-9]{1,2})\b", re.I)
_BLOCK_RE = re.compile(r"\bblock[\s\-_]*([a-z])\b", re.I)
_SECTOR_RE_FULL = re.compile(r"^sector[\s\-_]*([0-9]{1,3}[a-z]?)$", re.I)


def normalize_locality(text):
    """Extract a coarse locality token. Sectors in Gurugram/Noida are the
    dominant price driver, so 'Sector 84 Gurgaon' -> 'sector_84'."""
    if not text:
        return None
    s = str(text).strip()
    m = _SECTOR_RE_FULL.match(s)
    if m:
        return "sector_" + m.group(1).lower()
    m = _SECTOR_RE.search(s)
    if m:
        return "sector_" + m.group(1).lower()
    parts = [p.strip() for p in s.split(",") if p.strip()]
    if not parts:
        return None
    head = parts[0].lower()
    head = re.sub(r"[^a-z0-9 ]+", " ", head)
    head = re.sub(r"\s+", " ", head).strip()
    return head[:60] or None


def extract_sector(text):
    if not text:
        return None
    m = _SECTOR_RE.search(str(text))
    if not m:
        return None
    return m.group(1).lower()


def extract_phase(text):
    if not text:
        return None
    m = _PHASE_RE.search(str(text))
    return m.group(1) if m else None
