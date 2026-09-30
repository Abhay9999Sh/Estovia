/**
 * Request validation and normalisation for the valuation engine.
 *
 * Everything the model needs arrives as loosely typed JSON (form posts send
 * strings), so this module is the single place that turns that into the strict
 * shape `features.js` expects. Two rules:
 *
 *  1. Absent means `null`, never `0` and never `""`. The Python trainer treats
 *     "missing" and "zero" completely differently (`bedrooms or nan` makes 0
 *     missing, and imputation only fires on missing), so collapsing them here
 *     would quietly change the prediction.
 *  2. Anything the model was never trained on is dropped rather than guessed.
 *     `land` and `commercial` have no trained model, so those categories are
 *     refused instead of being scored.
 */

import { PROPERTY_CATEGORIES } from "./features.js";

/**
 * The exact city strings used as keys in the model artefacts, from
 * `artifacts/registry.json`. Do not add aliases here: a city whose name does
 * not match the key in `localityStats` or the comparable index silently falls
 * back to the global median. Aliases are resolved in `normalizeCity` below and
 * always normalise to one of these six.
 */
export const SUPPORTED_CITIES = [
  "Faridabad",
  "Ghaziabad",
  "Greater Noida",
  "Gurugram",
  "New Delhi",
  "Noida",
];

/** New Delhi and Delhi NCR are the same city; accept both spellings. */
const CITY_ALIASES = {
  delhi: "New Delhi",
  "new delhi": "New Delhi",
  "new delhi (ncr)": "New Delhi",
  "delhi ncr": "New Delhi",
  gurgaon: "Gurugram",
  noida: "Noida",
  "greater noida": "Greater Noida",
  ghaziabad: "Ghaziabad",
  faridabad: "Faridabad",
};

/**
 * Categories inside the `builtup` segment, used only as a fallback and as the
 * shape the UI offers. The authoritative list at request time is the model's
 * own `categoryStats`, passed into `checkSupported`, so training a new category
 * cannot leave this list silently stale and refusing valid requests.
 */
export const SUPPORTED_CATEGORIES = ["apartment", "independent_house", "villa"];

/** The only segment with a trained model. */
export const SUPPORTED_SEGMENT = "builtup";

export const FACING_VALUES = Object.keys({
  north: 1,
  north_east: 1,
  east: 1,
  south_east: 1,
  south: 1,
  south_west: 1,
  west: 1,
  north_west: 1,
});

export const FURNISHING_VALUES = ["unfurnished", "semi_furnished", "furnished"];
export const OWNERSHIP_VALUES = ["freehold", "leasehold", "society"];
export const TRANSACTION_VALUES = ["new_property", "resale"];
export const AREA_DEFINITION_VALUES = ["built_up", "carpet", "plot", "total"];

/**
 * Area units, with the same factors as `estovia_ml/units.py`. A bare "bigha"
 * is deliberately absent: it means 27,225 sq ft in Haryana and 27,000 in Uttar
 * Pradesh, so guessing it would be a silent 0.8% error in the target itself.
 */
export const AREA_UNITS = {
  sqft: 1,
  sqyd: 9,
  sqm: 10.7639104167097,
  acre: 43560,
  hectare: 107639.104167097,
  marla: 225,
  bigha_haryana: 27225,
  bigha_up: 27000,
  biswa_haryana: 2722.5,
  biswa_up: 2700,
  guntha: 1089,
};

export const AREA_UNIT_LABELS = {
  sqft: "sq ft",
  sqyd: "sq yd",
  sqm: "sq m",
  acre: "acre",
  hectare: "hectare",
  marla: "marla",
  bigha_haryana: "bigha (Haryana)",
  bigha_up: "bigha (Uttar Pradesh)",
  biswa_haryana: "biswa (Haryana)",
  biswa_up: "biswa (Uttar Pradesh)",
  guntha: "guntha",
};

/** Sanity bounds. Beyond these the model is extrapolating, not estimating. */
export const LIMITS = {
  areaSqFt: { min: 100, max: 100000 },
  bedrooms: { min: 0, max: 20 },
  bathrooms: { min: 0, max: 20 },
  balconies: { min: 0, max: 10 },
  propertyAgeYears: { min: 0, max: 120 },
  floorNumber: { min: -5, max: 200 },
  totalFloors: { min: 1, max: 200 },
  parkingCount: { min: 0, max: 20 },
};

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
    this.field = field;
  }
}

function optionalNumber(value, bounds, field, label, { integer = false } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new ValidationError(`${label} must be a number.`, field);
  }
  if (integer && !Number.isInteger(n)) {
    throw new ValidationError(`${label} must be a whole number.`, field);
  }
  if (bounds && (n < bounds.min || n > bounds.max)) {
    throw new ValidationError(
      `${label} must be between ${bounds.min} and ${bounds.max}.`,
      field
    );
  }
  return n;
}

function optionalEnum(value, allowed, field, label, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const v = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!allowed.includes(v)) {
    throw new ValidationError(`${label} is not a recognised option.`, field);
  }
  return v;
}

function optionalBool(value, field, label) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  const v = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  throw new ValidationError(`${label} must be yes or no.`, field);
}

function cleanText(value, max = 120) {
  if (value === undefined || value === null) return null;
  const s = String(value).replace(/<[^>]*>/g, "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

export function normalizeCity(value) {
  const raw = cleanText(value, 80);
  if (!raw) return null;
  const direct = SUPPORTED_CITIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  if (direct) return direct;
  const aliased = CITY_ALIASES[raw.toLowerCase()];
  if (aliased) return aliased;
  return raw; // not supported; the caller reports unsupported_location
}

/**
 * Normalise a raw request body into the shape the feature builder consumes.
 * Throws `ValidationError` for anything unusable.
 */
export function normalizeInput(body = {}) {
  const propertyCategory = optionalEnum(
    body.propertyCategory,
    PROPERTY_CATEGORIES,
    "propertyCategory",
    "Property type"
  );
  if (!propertyCategory) {
    throw new ValidationError("Please choose a property type.", "propertyCategory");
  }

  const city = normalizeCity(body.city);
  if (!city) {
    throw new ValidationError("Please choose a city.", "city");
  }

  const unit = String(body.areaUnit || "sqft").trim().toLowerCase();
  const factor = AREA_UNITS[unit];
  if (!factor) {
    throw new ValidationError("Please choose a valid area unit.", "areaUnit");
  }
  const rawArea = Number(body.areaSqFt ?? body.area);
  if (!Number.isFinite(rawArea) || rawArea <= 0) {
    throw new ValidationError("Please enter the built-up area.", "areaSqFt");
  }
  const areaSqFt = rawArea * factor;
  if (areaSqFt < LIMITS.areaSqFt.min || areaSqFt > LIMITS.areaSqFt.max) {
    throw new ValidationError(
      `Area must be between ${LIMITS.areaSqFt.min} and ${LIMITS.areaSqFt.max} sq ft.`,
      "areaSqFt"
    );
  }

  const latitude = optionalNumber(body.latitude, { min: -90, max: 90 }, "latitude", "Latitude");
  const longitude = optionalNumber(body.longitude, { min: -180, max: 180 }, "longitude", "Longitude");

  // NOT normalised on purpose. `localityStats` and `localityFreq` are keyed on
  // the raw training strings, which include trailing newlines, so trimming
  // here would miss the locality target encoding and fall back to the global
  // median. Use the verbatim spelling offered by locality autocomplete, or
  // accept the documented unseen-locality warning.
  let locality = null;
  if (body.locality !== undefined && body.locality !== null && body.locality !== "") {
    if (typeof body.locality !== "string") {
      throw new ValidationError("Locality must be text.", "locality");
    }
    if (body.locality.length > 200) {
      throw new ValidationError("That locality name is too long.", "locality");
    }
    locality = body.locality;
  }

  return {
    segment: SUPPORTED_SEGMENT,
    propertyCategory,
    city,
    locality,
    state: cleanText(body.state, 80),
    district: cleanText(body.district, 80),
    pincode: cleanText(body.pincode, 12),
    latitude,
    longitude,
    areaSqFt,
    areaUnitOriginal: unit,
    areaValueOriginal: rawArea,
    areaDefinition: optionalEnum(
      body.areaDefinition,
      AREA_DEFINITION_VALUES,
      "areaDefinition",
      "Area basis",
      "built_up"
    ),
    bedrooms: optionalNumber(body.bedrooms, LIMITS.bedrooms, "bedrooms", "Bedrooms", { integer: true }),
    bathrooms: optionalNumber(body.bathrooms, LIMITS.bathrooms, "bathrooms", "Bathrooms", { integer: true }),
    balconies: optionalNumber(body.balconies, LIMITS.balconies, "balconies", "Balconies", { integer: true }),
    floorNumber: optionalNumber(body.floorNumber, LIMITS.floorNumber, "floorNumber", "Floor", { integer: true }),
    totalFloors: optionalNumber(body.totalFloors, LIMITS.totalFloors, "totalFloors", "Total floors", { integer: true }),
    propertyAgeYears: optionalNumber(
      body.propertyAgeYears,
      LIMITS.propertyAgeYears,
      "propertyAgeYears",
      "Property age"
    ),
    liftAvailable: optionalBool(body.liftAvailable, "liftAvailable", "Lift"),
    parkingCount: optionalNumber(body.parkingCount, LIMITS.parkingCount, "parkingCount", "Parking", { integer: true }),
    amenities: Array.isArray(body.amenities)
      ? body.amenities.map((a) => cleanText(a, 60)).filter(Boolean).slice(0, 40)
      : [],
    amenityFlags:
      body.amenityFlags && typeof body.amenityFlags === "object" && !Array.isArray(body.amenityFlags)
        ? body.amenityFlags
        : null,
    facing: optionalEnum(body.facing, FACING_VALUES, "facing", "Facing"),
    furnishing: optionalEnum(body.furnishing, FURNISHING_VALUES, "furnishing", "Furnishing"),
    ownership: optionalEnum(body.ownership, OWNERSHIP_VALUES, "ownership", "Ownership"),
    transactionType: optionalEnum(body.transactionType, TRANSACTION_VALUES, "transactionType", "Transaction type"),
    // The model was trained without OSM enrichment, so this stays null and the
    // geospatial block is imputed to 0.0 exactly as it was at evaluation time.
    geoFeatures: null,
    geoDataAvailable: false,
  };
}

/**
 * Checks that must run before we are willing to produce a number at all.
 *
 * `supportedCategories` is passed in from the loaded artefact so this cannot
 * drift from what was actually trained; the module constant is only a default
 * for callers that have not loaded a model yet.
 */
export function checkSupported(input, supportedCategories = SUPPORTED_CATEGORIES) {
  if (!supportedCategories.includes(input.propertyCategory)) {
    return {
      status: "unsupported_category",
      message:
        "This model covers built-up homes only (apartment, independent house or villa). " +
        "Land and commercial property are not supported yet.",
    };
  }
  if (!SUPPORTED_CITIES.includes(input.city)) {
    return {
      status: "unsupported_location",
      message:
        `No model covers ${input.city}. The engine is trained on Delhi NCR only.`,
    };
  }
  return null;
}
