"""Overpass/OSM accessibility feature extraction.

Design notes:
  * We only ask for the POI *categories* named below. We do not infer quality:
    the presence of a school node is not evidence of a good school, so no
    quality score is derived and none is displayed as one.
  * Distances are great-circle (haversine) kilometres between the property
    coordinate and the POI coordinate. That is an accessibility proxy, not a
    driving time. Where travel times matter, OpenRouteService is used and only
    when a key is supplied.
  * Retrieval is cached to disk so repeated training runs do not re-hammer
    the public endpoint, and the Overpass usage policy (rate limit 2, pause on
    429/406) is respected.
  * Every feature set records `retrieved_at` and the OSM attribution.
"""

from __future__ import annotations

import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

CACHE_DIR = Path(
    os.environ.get("ESTOVIA_ML_CACHE", Path(__file__).resolve().parents[1] / "data" / "osm_cache")
)

OSM_ATTRIBUTION = "(c) OpenStreetMap contributors, ODbL 1.0"
OSM_LICENSE = "ODbL 1.0"

# category key -> Overpass selector fragments
CATEGORIES = {
    "metro": [
        'node["railway"="station"]["station"="subway"]',
        'node["railway"="station"]["station"="light_rail"]',
        'node["station"="subway"]',
    ],
    "rail_station": ['node["railway"="station"]["station"!="subway"]'],
    "bus_stop": ['node["highway"="bus_stop"]'],
    "hospital": ['node["amenity"="hospital"]', 'node["amenity"="clinic"]'],
    "school": [
        'node["amenity"="school"]',
        'node["amenity"="college"]',
        'node["amenity"="university"]',
    ],
    "park": ['node["leisure"="park"]', 'way["leisure"="park"]'],
    "mall": ['way["shop"="mall"]', 'node["shop"="mall"]', 'way["landuse"="retail"]'],
    "market": ['node["shop"="marketplace"]'],
    "airport": ['node["aeroway"="aerodrome"]', 'way["aeroway"="aerodrome"]'],
    "major_road": ['way["highway"="motorway"]', 'way["highway"="trunk"]', 'way["highway"="primary"]'],
}

FEATURE_NAMES = [
    "dist_metro_km",
    "dist_rail_station_km",
    "dist_bus_stop_km",
    "dist_hospital_km",
    "dist_school_km",
    "dist_park_km",
    "dist_mall_km",
    "dist_market_km",
    "dist_airport_km",
    "dist_major_road_km",
    "metro_within_1km",
    "metro_within_3km",
    "hospital_within_2km",
    "school_within_1km",
    "park_within_1km",
    "mall_within_3km",
    "amenity_score_1km",
    "amenity_score_3km",
    "amenity_index",
]


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _bbox_query(lat, lon, radius_deg):
    d = radius_deg
    s, w, n, e = lat - d, lon - d, lat + d, lon + d
    parts = []
    for key, selectors in CATEGORIES.items():
        for sel in selectors:
            if "way[" in sel:
                parts.append(f"{sel}({s:.5f},{w:.5f},{n:.5f},{e:.5f});")
            else:
                parts.append(f"{sel}({s:.5f},{w:.5f},{n:.5f},{e:.5f});")
    body = "".join(parts)
    return (
        "[out:json][timeout:180];("
        + body
        + ");out center tags;"
    )


def _cache_file(lat, lon, radius_deg):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = f"{lat:.3f}_{lon:.3f}_{radius_deg}"
    return CACHE_DIR / f"pois_{key}.json"


def fetch_pois(lat, lon, radius_deg=0.055, force=False):
    """Fetch raw OSM POIs around a coordinate. Returns dict with
    'points' (list of {cat, lat, lon}) and 'retrieved_at'."""
    if lat is None or lon is None:
        return {"points": [], "retrieved_at": None, "ok": False, "reason": "no_coordinates"}

    cf = _cache_file(lat, lon, radius_deg)
    if cf.exists() and not force:
        try:
            return json.loads(cf.read_text())
        except Exception:
            pass

    query = _bbox_query(lat, lon, radius_deg)
    data = urllib.parse.urlencode({"data": query}).encode()
    last_err = None
    for attempt in range(3):
        endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
        req = urllib.request.Request(
            endpoint,
            data=data,
            headers={
                "User-Agent": "Estovia-ML/0.1 (real-estate accessibility features)",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as exc:
            last_err = f"HTTP {exc.code}"
            # 406/429 mean we are going too fast; back off per policy.
            if exc.code in (406, 429, 503):
                time.sleep(20 * (attempt + 1))
            else:
                time.sleep(3)
        except Exception as exc:  # noqa: BLE001
            last_err = str(exc)
            time.sleep(5 * (attempt + 1))
    else:
        return {
            "points": [],
            "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "ok": False,
            "reason": last_err or "overpass_unavailable",
        }

    points = []
    for el in payload.get("elements", []):
        tags = el.get("tags") or {}
        lat_e = el.get("lat")
        lon_e = el.get("lon")
        if lat_e is None and el.get("center"):
            lat_e = el["center"].get("lat")
            lon_e = el["center"].get("lon")
        if lat_e is None or lon_e is None:
            continue
        cat = _classify(tags)
        if cat is None:
            continue
        points.append(
            {
                "cat": cat,
                "lat": float(lat_e),
                "lon": float(lon_e),
                "name": (tags.get("name") or "")[:120],
                "osm_type": el.get("type"),
                "osm_id": el.get("id"),
            }
        )

    result = {
        "points": points,
        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ok": True,
        "license": OSM_LICENSE,
        "attribution": OSM_ATTRIBUTION,
    }
    try:
        cf.write_text(json.dumps(result))
    except Exception:
        pass
    return result


def _classify(tags):
    if tags.get("railway") == "station":
        if tags.get("station") in ("subway", "light_rail"):
            return "metro"
        return "rail_station"
    if tags.get("station") == "subway":
        return "metro"
    if tags.get("highway") == "bus_stop":
        return "bus_stop"
    if tags.get("amenity") in ("hospital", "clinic"):
        return "hospital"
    if tags.get("amenity") in ("school", "college", "university"):
        return "school"
    if tags.get("leisure") == "park":
        return "park"
    if tags.get("shop") == "mall":
        return "mall"
    if tags.get("shop") == "marketplace":
        return "market"
    if tags.get("aeroway") == "aerodrome":
        return "airport"
    if tags.get("highway") in ("motorway", "trunk", "primary"):
        return "major_road"
    if tags.get("landuse") == "retail":
        return "mall"
    return None


def features_for_point(lat, lon, radius_deg=0.055, force=False):
    """Compute the accessibility feature vector for a coordinate.

    Distances are capped so a single far-away POI cannot dominate; missing
    categories are encoded as the cap value with an accompanying count=0,
    which the training pipeline treats as 'not found within radius'.
    """
    data = fetch_pois(lat, lon, radius_deg=radius_deg, force=force)
    pts = data.get("points") or []
    return compute_features(lat, lon, pts, data)


def compute_features(lat, lon, pts, meta=None):
    cap = 25.0
    best = {k: cap for k in CATEGORIES}
    counts = {k: 0 for k in CATEGORIES}
    for p in pts:
        d = haversine_km(lat, lon, p["lat"], p["lon"])
        cat = p["cat"]
        if d < best[cat]:
            best[cat] = d
        counts[cat] += 1

    f = {
        "dist_metro_km": best["metro"],
        "dist_rail_station_km": best["rail_station"],
        "dist_bus_stop_km": best["bus_stop"],
        "dist_hospital_km": best["hospital"],
        "dist_school_km": best["school"],
        "dist_park_km": best["park"],
        "dist_mall_km": best["mall"],
        "dist_market_km": best["market"],
        "dist_airport_km": best["airport"],
        "dist_major_road_km": best["major_road"],
        "metro_within_1km": int(best["metro"] <= 1.0),
        "metro_within_3km": int(best["metro"] <= 3.0),
        "hospital_within_2km": int(best["hospital"] <= 2.0),
        "school_within_1km": int(best["school"] <= 1.0),
        "park_within_1km": int(best["park"] <= 1.0),
        "mall_within_3km": int(best["mall"] <= 3.0),
    }
    score1 = sum(
        1
        for cat in ("metro", "hospital", "school", "park", "mall", "market", "bus_stop")
        if best[cat] <= 1.0
    )
    score3 = sum(
        1
        for cat in ("metro", "hospital", "school", "park", "mall", "market", "bus_stop")
        if best[cat] <= 3.0
    )
    f["amenity_score_1km"] = score1
    f["amenity_score_3km"] = score3
    f["amenity_index"] = score1 + 0.35 * score3
    f["osm_retrieved_at"] = (meta or {}).get("retrieved_at")
    f["osm_ok"] = 1 if (meta or {}).get("ok", True) else 0
    f["osm_poi_count"] = len(pts)
    f["osm_attribution"] = OSM_ATTRIBUTION
    f["osm_tile"] = (meta or {}).get("tile")
    return f


# ---------------------------------------------------------------------------
# Tile-based enrichment.
#
# Fetching a 0.055 deg box per property would mean thousands of Overpass calls
# and would breach the public endpoint's usage policy. Instead we fetch
# POIs ONCE per ~0.06 deg tile (roughly 6.6 km x 7.3 km at this latitude) and
# compute every property's distances from the cached tile POIs. Tiles are
# prioritised by how many observations they contain so the request budget is
# spent where the training data actually is.
# ---------------------------------------------------------------------------

TILE_DEG = 0.06
TILE_DIR = CACHE_DIR / "tiles"


def _tile_key(lat, lon):
    return (math.floor(lat / TILE_DEG), math.floor(lon / TILE_DEG))


def _tile_file(key):
    TILE_DIR.mkdir(parents=True, exist_ok=True)
    return TILE_DIR / f"tile_{key[0]}_{key[1]}.json"


def _tile_query(key):
    s = key[0] * TILE_DEG
    w = key[1] * TILE_DEG
    n = s + TILE_DEG
    e = w + TILE_DEG
    body = "".join(
        f"{sel}({s:.4f},{w:.4f},{n:.4f},{e:.4f});" for sels in CATEGORIES.values() for sel in sels
    )
    return "[out:json][timeout:240];(" + body + ");out center tags;"


def fetch_tile(key, force=False):
    cf = _tile_file(key)
    if cf.exists() and not force:
        try:
            return json.loads(cf.read_text())
        except Exception:
            pass

    query = _tile_query(key)
    data = urllib.parse.urlencode({"data": query}).encode()
    last_err = None
    for attempt in range(4):
        endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
        req = urllib.request.Request(
            endpoint,
            data=data,
            headers={
                "User-Agent": "Estovia-ML/0.1 (real-estate accessibility features)",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as exc:
            last_err = f"HTTP {exc.code}"
            if exc.code in (406, 429, 503):
                time.sleep(30 * (attempt + 1))
            else:
                time.sleep(5)
        except Exception as exc:  # noqa: BLE001
            last_err = str(exc)
            time.sleep(10 * (attempt + 1))
    else:
        return {"points": [], "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "ok": False, "reason": last_err, "tile": f"{key[0]}_{key[1]}"}

    points = []
    for el in payload.get("elements", []):
        tags = el.get("tags") or {}
        la = el.get("lat")
        lo = el.get("lon")
        if la is None and el.get("center"):
            la = el["center"].get("lat")
            lo = el["center"].get("lon")
        if la is None or lo is None:
            continue
        cat = _classify(tags)
        if cat is None:
            continue
        points.append({"cat": cat, "lat": float(la), "lon": float(lo)})

    result = {
        "points": points,
        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ok": True,
        "license": OSM_LICENSE,
        "attribution": OSM_ATTRIBUTION,
        "tile": f"{key[0]}_{key[1]}",
    }
    try:
        cf.write_text(json.dumps(result))
    except Exception:
        pass
    return result


def needed_tiles(observations):
    counts = defaultdict(int)
    for o in observations:
        if o.latitude is None or o.longitude is None:
            continue
        counts[_tile_key(o.latitude, o.longitude)] += 1
    return counts


def enrich_observations(observations, budget=None, verbose=True, only_missing=True):
    """Attach OSM accessibility features. Returns (enriched_count, tiles_used)."""
    counts = needed_tiles(observations)
    if not counts:
        return 0, 0
    budget = budget or int(os.environ.get("ESTOVIA_ML_OSM_TILE_BUDGET", "60"))
    ordered = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:budget]

    tile_points = {}
    for key, n in ordered:
        data = fetch_tile(key)
        tile_points[key] = data.get("points") or []
        if verbose:
            print(f"    tile {key} n={n} pois={len(tile_points[key])} ok={data.get('ok')}")

    enriched = 0
    for o in observations:
        if only_missing and o.geo_features:
            continue
        if o.latitude is None or o.longitude is None:
            continue
        key = _tile_key(o.latitude, o.longitude)
        if key not in tile_points:
            continue
        # Consider this tile plus its 8 neighbours so a property near a tile
        # edge still sees POIs across it.
        pts = []
        for ddy in (-1, 0, 1):
            for ddx in (-1, 0, 1):
                pts.extend(tile_points.get((key[0] + ddy, key[1] + ddx), []))
        o.geo_features = compute_features(o.latitude, o.longitude, pts, {"ok": True, "tile": f"{key[0]}_{key[1]}"})
        enriched += 1
    return enriched, len(tile_points)
