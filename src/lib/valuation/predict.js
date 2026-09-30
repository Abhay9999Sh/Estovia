/**
 * The valuation service: one call turns a normalised property into an estimate,
 * a calibrated interval, comparables, and an honest account of how much to
 * trust all of it.
 *
 * Three deliberate constraints:
 *
 *  1. The interval is *calibrated*, not invented. `q` comes from a split
 *     conformal fit on a held-out calibration set and is re-verified by
 *     `ml-service/scripts/verify_report_replay.py`. It is wide (about ±88%)
 *     because the model genuinely has 43.7% WAPE on unseen cities, and
 *     reporting a narrow band would be the easiest lie in this file.
 *  2. `result.valueInr` is the MODEL estimate and nothing else. A user's own
 *     asking price is carried separately in `askComparison` so the two can
 *     never be conflated.
 *  3. We never report a "confidence percentage". What we report is how much
 *     evidence sits behind this particular query, plus the model's own measured
 *     error on a real holdout.
 */

import fs from "fs";
import path from "path";

import { getModel, hasModel, predictTree, splitCountImportance } from "./model.js";
import {
  buildFeatureVector,
  localityIsKnown,
  localityObservationCount,
  missingInputs,
  PROPERTY_CATEGORIES,
} from "./features.js";
import {
  SUPPORTED_CITIES,
  SUPPORTED_SEGMENT,
  ValidationError,
  checkSupported,
  normalizeInput,
} from "./schema.js";
import { findComparables } from "./comparables.js";

// `let`, not `const`: the parsed registry is memoised into this binding on first
// use. Declaring it const here is the classic silent-cache bug.
let registryCache = globalThis.__estoviaRegistryCache || null;

function fail(message) {
  const error = new Error(message);
  error.status = 503;
  return error;
}

function resolveArtifactDir() {
  if (process.env.ML_MODEL_DIR) return path.resolve(process.env.ML_MODEL_DIR);
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, "src", "lib", "valuation", "artifacts");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), "src", "lib", "valuation", "artifacts");
}

function loadRegistry() {
  if (registryCache) return registryCache;
  const file = path.join(resolveArtifactDir(), "registry.json");
  if (!fs.existsSync(file)) {
    throw fail("Valuation registry is missing; run export_runtime_index.py.");
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const models = new Map();
  for (const m of parsed.models || []) models.set(m.segment, m);
  registryCache = { ...parsed, bySegment: models };
  return registryCache;
}

/**
 * Load the sidecar `model_<segment>.meta.json`.
 *
 * WHY THIS EXISTS, AND WHY IT MATTERS: the JSON header inside
 * `model_<segment>.bin` is a snapshot taken during export and still carries the
 * STALE conformal q from the earlier fit, with no `verifiedReplay` block at all.
 * The sidecar file written alongside it is the corrected one. Serving the
 * interval from the binary header would quietly ship the wrong, much narrower
 * band, so we read the sidecar and cross-check the pair instead of trusting
 * either.
 */
function loadMetaSidecar(segment) {
  const file = path.join(resolveArtifactDir(), `model_${segment}.meta.json`);
  if (!fs.existsSync(file)) {
    throw fail(
      `Model metadata sidecar is missing (${path.basename(file)}). ` +
        "Re-run export_runtime_model.py."
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Assert the binary and its sidecar describe the same model. A mismatch means
 * the binary was re-exported without refreshing the metadata (or vice versa),
 * and every number below would be unattributable, so refuse to serve.
 */
function assertArtifactsAgree(model) {
  const sidecar = loadMetaSidecar(model.meta.segment);
  const header = model.meta;
  if (sidecar.modelId !== header.modelId) {
    throw fail(
      `Model binary and metadata disagree: binary is ${header.modelId}, metadata is ` +
        `${sidecar.modelId}. Re-run export_runtime_model.py.`
    );
  }
  if (
    sidecar.featureSchemaVersion !== header.featureSchemaVersion ||
    sidecar.featureNames.length !== header.featureNames.length ||
    sidecar.featureNames.some((n, i) => n !== header.featureNames[i])
  ) {
    throw fail(
      "Model binary and metadata disagree about the feature schema. Re-run " +
        "export_runtime_model.py."
    );
  }
  return sidecar;
}

/**
 * The conformal `q` for a segment.
 *
 * `verifiedReplay.conformal` in the sidecar is the value re-derived from the
 * shipped binary and confirmed by verify_report_replay.py. The runtime registry
 * carries the same number. The binary header's own `conformal` block is stale
 * and is deliberately ignored; the two are compared so a future export that
 * moves them apart fails loudly instead of quietly reverting to a narrow band.
 */
function conformalFor(model) {
  const sidecar = assertArtifactsAgree(model);
  const verified = sidecar.verifiedReplay && sidecar.verifiedReplay.conformal;
  if (!verified || !Number.isFinite(verified.q)) {
    throw fail(
      "This model has no verified conformal interval. Re-run verify_report_replay.py " +
        "before serving predictions."
    );
  }
  const entry = loadRegistry().bySegment.get(model.meta.segment);
  if (entry && entry.conformal && Number.isFinite(entry.conformal.q)) {
    if (Math.abs(entry.conformal.q - verified.q) > 1e-12) {
      throw fail(
        `Conformal mismatch between metadata (${verified.q}) and registry ` +
          `(${entry.conformal.q}). Re-run export_runtime_index.py.`
      );
    }
  }
  // Loud, not fatal: the header value is known-stale, but if it ever changes we
  // want that in the logs rather than discovered by a user.
  const headerQ = model.meta.conformal && model.meta.conformal.q;
  if (Number.isFinite(headerQ) && Math.abs(headerQ - verified.q) > 1e-12) {
    console.warn(
      `[valuation] binary header q=${headerQ} differs from verified q=${verified.q}; ` +
        "using the verified value. Re-export to silence this."
    );
  }
  return verified;
}

/**
 * Local, honest feature attribution.
 *
 * Direction is measured, not asserted: for a feature we substitute the training
 * median and re-run the model. If the estimate rises, this input sits below the
 * training median for that feature and is pulling the price up. Magnitude is the
 * percentage change in the estimate, which is a real quantity.
 *
 * This is a local sensitivity, NOT a causal effect and NOT gain importance, and
 * the labels in the UI say so. Interactions between features mean the numbers do
 * not sum to the total, and we do not pretend they do.
 */
function explain(model, vector, topN = 8) {
  const importance = splitCountImportance(model, model.meta.featureNames, topN);
  if (!importance.length) return [];

  const baseline = predictTree(model, vector);
  const median = baseline;
  const factors = importance.map(({ key, splitPct }) => {
    const index = model.meta.featureNames.indexOf(key);
    const original = vector[index];
    const medians = model.meta.imputationMedians || {};
    if (!(key in medians)) return null;
    const probe = vector.slice();
    probe[index] = medians[key];
    const moved = predictTree(model, probe);
    const deltaPct = ((moved - median) * 100) / 100; // percent change in log price
    return {
      key,
      label: null, // filled by the caller from FEATURE_LABELS
      direction:
        Math.abs(deltaPct) < 0.5 ? "neutral" : deltaPct > 0 ? "decrease" : "increase",
      // Positive means "moving toward the median lowers the estimate", i.e. this
      // input is holding the price up.
      contributionPct: Math.round(deltaPct * 100) / 100,
      splitPct: Math.round(splitPct * 100) / 100,
      fromValue: Math.round(original * 1000) / 1000,
      toValue: medians[key],
      fromDisplay: formatFeatureValue(key, original),
      toDisplay: formatFeatureValue(key, medians[key]),
    };
  });
  return factors.filter(Boolean);
}

/**
 * Render a feature value the way a person would read it.
 *
 * Four of the model's features are logs, and `locality_te`/`_city_te`/
 * `_category_te` are log prices per square foot. Printing those raw shows
 * "7.131 vs 7.166265974133638", which is noise to a user and looks broken.
 * Exponentiating them turns the same number into "Rs 1,250/sq ft" or
 * "Rs 6,800/sq ft", which is the quantity they actually care about.
 */
const LOG_TO_VALUE = {
  log_area_sqft: { label: "area", transform: Math.exp, unit: "sq ft", dp: 0 },
  log_bed_area_ratio: {
    label: "bedroom density",
    transform: Math.exp,
    unit: "beds per 1,000 sq ft",
    dp: 2,
  },
  log_locality_freq: { label: "locality listings", transform: Math.exp, unit: "", dp: 0 },
  locality_te: { label: "locality price level", transform: Math.exp, unit: "Rs/sq ft", dp: 0 },
  _city_te: { label: "city price level", transform: Math.exp, unit: "Rs/sq ft", dp: 0 },
  _category_te: { label: "type price level", transform: Math.exp, unit: "Rs/sq ft", dp: 0 },
};

function formatFeatureValue(key, value) {
  if (!Number.isFinite(Number(value))) return "not available";
  const spec = LOG_TO_VALUE[key];
  if (spec) {
    const v = spec.transform(Number(value));
    return `${v.toLocaleString("en-IN", {
      maximumFractionDigits: spec.dp,
    })} ${spec.unit}`.trim();
  }
  const n = Number(value);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

/** Human labels for the features we surface, mirroring FEATURE_LABELS in Python. */
export const FEATURE_LABELS = {
  log_area_sqft: "Carpet area",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  balconies: "Balconies",
  floor_number: "Floor",
  total_floors: "Floors in building",
  floor_ratio: "Floor position",
  is_ground_floor: "Ground floor",
  is_top_floor: "Top floor",
  property_age_years: "Property age",
  is_new_build: "New construction",
  lift_available: "Lift",
  parking_count: "Parking",
  amenity_count_source: "Amenities listed",
  furnishing_ord: "Furnishing",
  facing_ord: "Facing",
  ownership_ord: "Ownership",
  transaction_ord: "New or resale",
  area_definition_ord: "Area basis",
  has_coordinates: "Has map location",
  locality_te: "Locality price level",
  log_locality_freq: "How common this locality is",
  _city_te: "City price level",
  _category_te: "Property type price level",
  property_category: "Property type",
  dist_metro_km: "Distance to metro",
  dist_rail_station_km: "Distance to railway",
  dist_bus_stop_km: "Distance to bus stop",
  dist_hospital_km: "Distance to hospital",
  dist_school_km: "Distance to school",
  dist_park_km: "Distance to park",
  dist_mall_km: "Distance to mall",
  dist_market_km: "Distance to market",
  dist_airport_km: "Distance to airport",
  dist_major_road_km: "Distance to main road",
  metro_within_1km: "Metro within 1 km",
  metro_within_3km: "Metro within 3 km",
  hospital_within_2km: "Hospital within 2 km",
  school_within_1km: "School within 1 km",
  park_within_1km: "Park within 1 km",
  mall_within_3km: "Mall within 3 km",
  amenity_score_1km: "Nearby amenities (1 km)",
  amenity_score_3km: "Nearby amenities (3 km)",
  amenity_index: "Overall accessibility",
  geo_data_available: "Geospatial data available",
  log_bed_area_ratio: "Bedroom density",
};

function round(n, dp = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Grade how much evidence sits behind THIS query. Not a statistical confidence:
 * it counts what we actually know about the locality and the inputs supplied.
 */
function gradeCoverage({ localityKnown, localityFreq, comparableCount, tier, missing, bucket, input }) {
  const reasons = [];
  let level = "sufficient";

  if (!localityKnown) {
    level = "low";
    reasons.push(
      "This locality was not in the model's training data, so the estimate leans on the " +
        "city and property-type price levels instead of a measured local rate."
    );
  } else if (localityFreq < 20) {
    level = "limited";
    reasons.push(
      `Only ${localityFreq} training listing${localityFreq === 1 ? "" : "s"} came from this ` +
        "locality, so its price level is thinly estimated."
    );
  }

  if (tier === "city") {
    if (level === "sufficient") level = "limited";
    reasons.push(
      "No comparable listings were found for this exact locality, so the neighbourhood " +
        "reference comes from elsewhere in the same city."
    );
  } else if (tier === "none") {
    level = "low";
    reasons.push("No comparable listings were found for this city and property type.");
  }

  if (missing.length) {
    if (level === "sufficient") level = "limited";
    reasons.push(
      `You left ${missing.length} field${missing.length === 1 ? "" : "s"} blank, so the model ` +
        "used training-average values for them."
    );
  }

  if (bucket && bucket.medianAreaSqFt) {
    const ratio = input.areaSqFt / bucket.medianAreaSqFt;
    if (ratio > 3 || ratio < 1 / 3) {
      level = level === "sufficient" ? "limited" : level;
      reasons.push(
        "This property is much larger or smaller than the typical comparable in this " +
          "locality, which is the range the model saw most often."
      );
    }
  }

  const labels = {
    sufficient: "Good data coverage for this locality",
    limited: "Limited data coverage",
    low: "Thin data coverage, treat this as a rough guide",
    out_of_distribution: "Outside the range this model was trained on",
    unsupported: "Not supported by this model",
  };

  return {
    level,
    label: labels[level],
    reasons,
    comparableCount,
    localityObservations: localityFreq,
  };
}

/**
 * Predict an asking-price estimate for one property.
 *
 * @param {object} body  raw request body (see schema.js)
 * @param {object} opts  { askingPriceInr, askingPriceType, requestContext, listingRef, ... }
 */
export function predict(body, opts = {}) {
  const input = normalizeInput(body);

  // Load the model first so the category check below can use the categories
  // this artefact was actually trained on, not a list that can go stale.
  const model = getModel(input.segment);
  if (!model || !model.available) {
    return {
      status: "no_model_for_segment",
      message: "No valuation model is deployed for this property type yet.",
      modelMeta: null,
      inputSnapshot: snapshot(input),
      result: { status: "no_model_for_segment", message: "No model available.", currency: "INR" },
      coverage: {
        coverageLevel: "unsupported",
        coverageLabel: "No model available",
        coverageReasons: ["No model is deployed for this segment."],
        comparableCount: 0,
        localityObservations: 0,
      },
      explainability: { factors: [], comparables: [], limitations: ["No model available."] },
      askComparison: comparisonOnly(opts, null),
      flags: ["no_model_for_segment"],
    };
  }

  // Refusals next: an unsupported category or city must never reach the trees.
  const unsupported = checkSupported(input, Object.keys(model.meta.categoryStats || {}));
  if (unsupported) {
    return {
      status: unsupported.status,
      message: unsupported.message,
      modelMeta: null,
      inputSnapshot: snapshot(input),
      result: { status: unsupported.status, message: unsupported.message, currency: "INR" },
      coverage: {
        coverageLevel: "unsupported",
        coverageLabel: "Not supported by this model",
        coverageReasons: [unsupported.message],
        comparableCount: 0,
        localityObservations: 0,
      },
      explainability: { factors: [], comparables: [], limitations: [unsupported.message] },
      askComparison: comparisonOnly(opts, null),
      flags: [unsupported.status],
    };
  }

  const meta = model.meta;
  const registry = loadRegistry().bySegment.get(input.segment);
  const conformal = conformalFor(model);

  const vector = buildFeatureVector(input, model);
  const margin = predictTree(model, vector);
  const pricePerSqFt = Math.exp(margin);
  const valueInr = pricePerSqFt * input.areaSqFt;
  const lowInr = Math.max(0, valueInr * (1 - conformal.q));
  const highInr = valueInr * (1 + conformal.q);

  const comparables = findComparables(input, { limit: 6 });
  const localityKnown = localityIsKnown(model, input.locality);
  const localityFreq = localityObservationCount(model, input.locality);
  const missing = missingInputs(input);
  const coverage = gradeCoverage({
    localityKnown,
    localityFreq,
    comparableCount: comparables.count,
    tier: comparables.tier,
    missing,
    bucket: comparables.bucket,
    input,
  });

  const flags = [];
  if (!localityKnown) flags.push("unseen_locality");
  if (localityKnown && localityFreq < 20) flags.push("thin_locality_evidence");
  if (comparables.tier !== "locality") flags.push("no_locality_comparables");
  if (missing.length) flags.push("imputed_inputs");
  flags.push("no_geospatial_data");

  const metrics = (registry && registry.testMetrics) || {};
  const nominalCoveragePct = round((1 - conformal.alpha) * 100, 0);
  const limitations = [
    "This is an estimate of the advertised asking price, not a registered sale price. " +
      "Asking prices and actual transaction prices differ.",
    "The model was evaluated on listings in Faridabad and Greater Noida, which it had " +
      `never seen during training. On that holdout its own error was ` +
      `${round(metrics.wape_pct, 1)}% of the total price (median ${round(metrics.median_ape_pct, 1)}%).`,
    `The range above is a ${nominalCoveragePct}% conformal band, so about ` +
      `${round(conformal.alpha * 100, 0)}% of comparable properties fall outside it. It is wide ` +
      "because the model's real error is wide, not because of rounding.",
    "No geospatial enrichment was available for the training data, so distance-to-metro, " +
      "schools and amenities are not part of this estimate.",
    "Matching areas, bedrooms, floors, locality, furnishing, lift, parking and listed " +
      "amenities will tell you far more about where the number moves than the range alone.",
  ];

  const factors = explain(model, vector).map((f) => ({
    key: f.key,
    label: FEATURE_LABELS[f.key] || f.key,
    group: "input",
    direction: f.direction,
    contributionPct: f.contributionPct,
    splitPct: f.splitPct,
    display: `${f.fromDisplay} vs typical ${f.toDisplay}`,
  }));

  return {
    status: "ok",
    message: "",
    modelMeta: {
      modelId: meta.modelId,
      modelVersion: meta.version,
      segment: meta.segment,
      estimator: meta.estimatorName,
      trainedAt: meta.trainedAt,
      featureSchemaVersion: meta.featureSchemaVersion,
      target: meta.target,
      targetSemantics: meta.targetSemantics,
      metrics,
      metricsProvenance: (registry && registry.testMetricsProvenance) || null,
    },
    inputSnapshot: snapshot(input),
    result: {
      status: "ok",
      valueInr: round(valueInr),
      lowInr: round(lowInr),
      highInr: round(highInr),
      pricePerSqFt: round(pricePerSqFt, 2),
      currency: "INR",
      message: "",
    },
    coverage: {
      intervalMethod: conformal.method,
      intervalAlpha: conformal.alpha,
      intervalQ: round(conformal.q, 6),
      intervalNominalCoveragePct: round((1 - conformal.alpha) * 100, 1),
      intervalMeasuredCoveragePct: round(metrics.interval_coverage_pct, 2),
      intervalNCalibration: conformal.n_calibration,
      coverageLevel: coverage.level,
      coverageLabel: coverage.label,
      comparableCount: coverage.comparableCount,
      localityObservations: coverage.localityObservations,
      coverageReasons: coverage.reasons,
    },
    explainability: {
      explanationMethod: "local_median_perturbation",
      factors,
      comparableCount: comparables.count,
      comparables: comparables.samples,
      comparablesTier: comparables.tier,
      comparablesBucket: comparables.bucket,
      limitations,
    },
    askComparison: comparisonOnly(opts, valueInr),
    flags,
  };
}

function snapshot(input) {
  return {
    propertyCategory: input.propertyCategory,
    city: input.city,
    locality: input.locality || "",
    state: input.state || "",
    district: input.district || "",
    pincode: input.pincode || "",
    latitude: input.latitude,
    longitude: input.longitude,
    areaSqFt: round(input.areaSqFt, 2),
    areaDefinition: input.areaDefinition,
    areaValueOriginal: input.areaValueOriginal,
    areaUnitOriginal: input.areaUnitOriginal,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    balconies: input.balconies,
    floorNumber: input.floorNumber,
    totalFloors: input.totalFloors,
    propertyAgeYears: input.propertyAgeYears,
    facing: input.facing || "",
    furnishing: input.furnishing || "",
    ownership: input.ownership || "",
    transactionType: input.transactionType || "",
    liftAvailable: input.liftAvailable,
    parkingCount: input.parkingCount,
    amenities: input.amenities,
    geoDataAvailable: false,
    missingInputs: missingInputs(input),
  };
}

function comparisonOnly(opts, valueInr) {
  const asking = Number(opts.askingPriceInr);
  const hasAsk = Number.isFinite(asking) && asking > 0;
  const out = {
    askingPriceInr: hasAsk ? round(asking) : null,
    askingPriceType: opts.askingPriceType || "",
    differenceInr: null,
    differencePct: null,
    comparisonBasis: hasAsk && valueInr
      ? "model estimate of advertised asking price for the same property, not a sale price"
      : "",
    comparingField: opts.comparingField || "none",
  };
  if (hasAsk && valueInr) {
    out.differenceInr = round(asking - valueInr);
    out.differencePct = round(((asking - valueInr) / valueInr) * 100, 1);
  }
  return out;
}

/** Metadata for the `/model` endpoint and the UI's model card. */
export function describeModel(segment = SUPPORTED_SEGMENT) {
  if (!hasModel(segment)) {
    return { available: false, segment, reason: `no trained model registered for "${segment}"` };
  }
  const model = getModel(segment);
  const meta = model.meta;
  const registry = loadRegistry();
  const entry = registry.bySegment.get(segment);
  const conformal = conformalFor(model);
  return {
    available: true,
    segment,
    modelId: meta.modelId,
    version: meta.version,
    estimator: meta.estimatorName,
    trainedAt: meta.trainedAt,
    featureSchemaVersion: meta.featureSchemaVersion,
    featureNames: meta.featureNames,
    target: meta.target,
    targetHuman: meta.targetHuman,
    targetSemantics: meta.targetSemantics,
    geography: registry.geography || null,
    segmentsNotTrained: registry.segmentsNotTrained || [],
    segmentsObserved: registry.segmentsObserved || [],
    // Derived from the artefact's own category_stats rather than a hardcoded
    // list, so adding a category to training updates this automatically.
    supportedCategories: Object.keys(meta.categoryStats || {}).sort(),
    categoriesNotCovered: PROPERTY_CATEGORIES.filter(
      (c) => !(meta.categoryStats || {})[c]
    ),
    supportedCities: SUPPORTED_CITIES,
    interval: {
      method: conformal.method,
      alpha: conformal.alpha,
      q: conformal.q,
      nCalibration: conformal.n_calibration,
    },
    metrics: (entry && entry.testMetrics) || null,
    metricsProvenance: (entry && entry.testMetricsProvenance) || null,
    baselineMetrics: (entry && entry.baselineMetrics) || null,
    beatsBaseline: entry ? entry.beatsBaseline : null,
    split: (entry && entry.split) || null,
    observations: (entry && entry.observations) || null,
    nonCommercialSourcesIncluded: entry ? entry.nonCommercialSourcesIncluded : null,
    params: meta.params || null,
    importance: splitCountImportance(model, meta.featureNames, 12).map((f) => ({
      key: f.key,
      label: FEATURE_LABELS[f.key] || f.key,
      splitPct: round(f.splitPct, 2),
    })),
  };
}

export function clearRegistryCache() {
  globalThis.__estoviaRegistryCache = null;
}

export { ValidationError, normalizeInput, SUPPORTED_SEGMENT, SUPPORTED_CITIES };
