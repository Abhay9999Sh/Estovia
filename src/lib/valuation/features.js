/**
 * Feature transform for the valuation model.
 *
 * This is a line-by-line port of `ml-service/estovia_ml/features.py`
 * (`FeatureBuilder._base_row` + `FeatureBuilder.transform`). It is NOT a
 * re-implementation: the trained trees split on 46 specific columns in a
 * specific order, and any drift between this file and the Python trainer
 * silently produces wrong numbers rather than an error.
 *
 * `ml-service/scripts/verify_js_features.py` proves the two agree by diffing
 * the vectors this module produces against the ones Python produces for real
 * observations. Run it after touching anything here.
 *
 * Everything learned during training (imputation medians, smoothed target
 * encodings, locality frequency counts) is read from the exported artefact.
 * Nothing is fitted at request time.
 */

// Explicit `.js` extensions: Next resolves these fine, and they also let the
// verification scripts import this module directly under plain Node ESM.
import { getModel } from "./model.js";

/** Must match `PROPERTY_CATEGORIES` in estovia_ml/schema.py, in order. */
export const PROPERTY_CATEGORIES = [
  "land_residential",
  "land_agricultural",
  "land_commercial",
  "apartment",
  "independent_house",
  "villa",
  "plot",
  "commercial_unit",
];

/** Must match `FEATURE_NAMES` in estovia_ml/geospatial.py, in order. */
export const GEO_FEATURE_NAMES = [
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
];

/** Must match the dicts of the same name in estovia_ml/features.py. */
export const FURNISHING_ORD = {
  unfurnished: 0,
  semi_furnished: 1,
  furnished: 2,
  unknown: 1,
};
export const FACING_ORD = {
  north: 0.45,
  north_east: 0.625,
  east: 1.0,
  south_east: 0.375,
  south: 0.55,
  south_west: 0.125,
  west: 0.375,
  north_west: 0.875,
};
export const OWNERSHIP_ORD = {
  leasehold: 0,
  freehold: 1,
  society: 1,
  unknown: 0.5,
};
export const TRANSACTION_ORD = {
  new_property: 0,
  resale: 1,
  unknown: 0.5,
};
export const AREA_DEF_ORD = {
  carpet: 0,
  built_up: 1,
  plot: 0.5,
  total: 1,
};

/**
 * The key the model was trained against for a locality.
 *
 * DELIBERATELY verbatim: the training observations contain locality strings
 * with trailing newlines and double spaces, and `localityStats`/`localityFreq`
 * are keyed on those exact bytes. Trimming, collapsing or case-folding here
 * would miss the target encoding and silently fall back to the global median,
 * which is the single largest accuracy loss available in this pipeline.
 *
 * The reason this is safe for users is that the UI offers locality
 * autocomplete from the comparable index, so the value submitted is a spelling
 * that exists in the index. A hand-typed locality that does not match gets the
 * documented "unseen locality" warning instead of a quietly wrong number.
 */
export function localityKeyOf(locality) {
  return locality || "__none__";
}

/** Port of `estovia_ml/features.py::_safe_log`. */
function safeLog(x) {
  if (x === null || x === undefined) return NaN;
  const v = Number(x);
  if (!Number.isFinite(v) || v <= 0) return NaN;
  return Math.log(v);
}

/**
 * Port of `FeatureBuilder._base_row`. `input` must already be normalised by
 * `schema.js` so that absent values are `null` rather than `undefined` and
 * booleans are real booleans.
 */
function baseRow(input, localityTe, cityTe, categoryTe, freq) {
  const area = input.areaSqFt ? Number(input.areaSqFt) : 0;
  const floor = input.floorNumber;
  const total = input.totalFloors;
  const floorRatio =
    floor !== null && total ? (floor + 1) / total : null;

  // Python: `float(len(o.amenities or [])) if o.amenities else None`, then
  // falls back to counting positive flags. Two subtleties, both of which the
  // parity test caught:
  //   - an empty list yields None (imputed), because "no amenities listed" and
  //     "amenity count is zero" are different claims;
  //   - a non-empty flags dict full of zeros yields 0.0, not None, so it must
  //     not be treated as missing.
  let amenityCount = null;
  if (input.amenities && input.amenities.length) {
    amenityCount = input.amenities.length;
  } else if (input.amenityFlags && typeof input.amenityFlags === "object") {
    const flags = Object.values(input.amenityFlags);
    if (flags.length) {
      amenityCount = flags.filter(Boolean).length;
    }
  }

  const age = input.propertyAgeYears;
  const row = {
    log_area_sqft: safeLog(area),
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    balconies: input.balconies,
    floor_number: floor,
    total_floors: total,
    floor_ratio: floorRatio,
    is_ground_floor: floor !== null ? (floor === 0 ? 1 : 0) : null,
    is_top_floor:
      floor !== null && total !== null ? (floor >= total - 1 ? 1 : 0) : null,
    property_age_years: age,
    is_new_build: age !== null && age <= 1.0 ? 1 : 0,
    lift_available:
      input.liftAvailable !== null
        ? input.liftAvailable
          ? 1
          : 0
        : null,
    parking_count: input.parkingCount,
    amenity_count_source: amenityCount,
    furnishing_ord: lookupOrd(FURNISHING_ORD, input.furnishing),
    facing_ord: lookupOrd(FACING_ORD, input.facing),
    ownership_ord: lookupOrd(OWNERSHIP_ORD, input.ownership),
    transaction_ord: lookupOrd(TRANSACTION_ORD, input.transactionType),
    area_definition_ord: lookupOrd(AREA_DEF_ORD, input.areaDefinition),
    has_coordinates:
      input.latitude !== null && input.longitude !== null ? 1 : 0,
    // Python writes `(o.bedrooms or np.nan) / area * 1000`, so a bedrooms
    // value of 0 is falsy and becomes NaN rather than 0. Preserved here.
    log_bed_area_ratio: area
      ? safeLog(((input.bedrooms || NaN) / area) * 1000)
      : NaN,
    locality_te: localityTe,
    log_locality_freq: freq ? safeLog(freq) : NaN,
    property_category: PROPERTY_CATEGORIES.includes(input.propertyCategory)
      ? PROPERTY_CATEGORIES.indexOf(input.propertyCategory)
      : -1,
    _city_te: cityTe,
    _category_te: categoryTe,
  };

  const geo = input.geoFeatures || null;
  for (const name of GEO_FEATURE_NAMES) {
    row[name] = geo ? geo[name] ?? null : null;
  }
  row.geo_data_available = geo && geo.osm_ok ? 1 : 0;
  return row;
}

function lookupOrd(table, value) {
  if (value === null || value === undefined) return null;
  return Object.prototype.hasOwnProperty.call(table, value) ? table[value] : null;
}

/**
 * Turn one normalised input into the model's 46-element feature vector.
 *
 * @param {object} input  normalised property input, see `schema.js`
 * @param {object} model  a loaded model from `getModel()`
 * @returns {number[]}    vector ordered by `model.meta.featureNames`
 */
export function buildFeatureVector(input, model) {
  if (!model || !model.available) {
    throw Object.assign(
      new Error("No valuation model is loaded."),
      { status: 503 }
    );
  }
  const meta = model.meta;
  const medians = meta.imputationMedians || {};
  const globalMedian = meta.globalMedianLogPpsf;
  const locKey = localityKeyOf(input.locality);

  const localityTe = Object.prototype.hasOwnProperty.call(meta.localityStats || {}, locKey)
    ? meta.localityStats[locKey]
    : globalMedian;
  const cityKey = input.city || "__none__";
  const cityTe = Object.prototype.hasOwnProperty.call(meta.cityStats || {}, cityKey)
    ? meta.cityStats[cityKey]
    : globalMedian;
  const categoryTe = Object.prototype.hasOwnProperty.call(
    meta.categoryStats || {},
    input.propertyCategory
  )
    ? meta.categoryStats[input.propertyCategory]
    : globalMedian;
  const freq = (meta.localityFreq || {})[locKey];

  const row = baseRow(input, localityTe, cityTe, categoryTe, freq);

  // Imputation, mirroring the two loops in FeatureBuilder.transform: first the
  // medians that were learned, then the geospatial block, which falls back to
  // 0.0 rather than a median because no training row carried OSM data.
  for (const name of Object.keys(medians)) {
    const v = row[name];
    if (v === null || v === undefined || !Number.isFinite(Number(v))) {
      row[name] = medians[name];
    }
  }
  for (const name of GEO_FEATURE_NAMES) {
    const v = row[name];
    if (v === null || v === undefined || !Number.isFinite(Number(v))) {
      row[name] = Object.prototype.hasOwnProperty.call(medians, name)
        ? medians[name]
        : 0.0;
    }
  }

  // Final assembly, matching the numpy fill. Anything still non-finite becomes
  // the training median for that column, or 0.0 if the column never had one.
  const vector = new Array(meta.featureNames.length);
  for (let j = 0; j < meta.featureNames.length; j += 1) {
    const name = meta.featureNames[j];
    let v = row[name];
    if (v === null || v === undefined) {
      v = NaN;
    }
    if (!Number.isFinite(Number(v))) {
      v = Object.prototype.hasOwnProperty.call(medians, name) ? medians[name] : 0.0;
    }
    vector[j] = Number(v);
  }
  return vector;
}

/** Names of inputs the caller left blank, so the response can be honest about it. */
export function missingInputs(input) {
  const numeric = [
    "areaSqFt",
    "bedrooms",
    "bathrooms",
    "balconies",
    "floorNumber",
    "totalFloors",
    "propertyAgeYears",
    "parkingCount",
  ];
  const categorical = [
    "facing",
    "furnishing",
    "ownership",
    "transactionType",
    "liftAvailable",
    "locality",
  ];
  return [
    ...numeric.filter((k) => input[k] === null || input[k] === undefined),
    ...categorical.filter((k) => input[k] === null || input[k] === undefined),
  ];
}

/**
 * True when this locality was present in the training fold, i.e. the model has
 * a measured price level for it rather than a global fallback.
 */
export function localityIsKnown(model, locality) {
  const key = localityKeyOf(locality);
  return Object.prototype.hasOwnProperty.call(model.meta.localityStats || {}, key);
}

export function localityObservationCount(model, locality) {
  const key = localityKeyOf(locality);
  return (model.meta.localityFreq || {})[key] || 0;
}

/** Convenience wrapper that loads the segment model first. */
export function featuresFor(segment, input) {
  return buildFeatureVector(input, getModel(segment));
}
