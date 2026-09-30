/**
 * Comparable-listing lookup.
 *
 * Backed by `artifacts/comparables.json`, which is built by
 * `ml-service/scripts/export_runtime_index.py` from the same real asking-price
 * observations the model was trained on. Buckets are keyed
 * `city|locality|propertyCategory` and carry an IQR band plus a handful of
 * individual listings.
 *
 * The file is 3.5 MB, so it is read lazily and cached on `globalThis` the same
 * way the model binary is: a warm serverless instance should parse it once.
 *
 * Every comparable carries `targetType: "asking_price"` and the licence of the
 * source it came from, so the UI can attribute it without inventing anything.
 */

import fs from "fs";
import path from "path";

// `let`, not `const`: this binding is replaced by the parsed index on first
// use and then reused for the life of the instance.
let cache = globalThis.__estoviaComparablesCache || null;

function fail(message) {
  return Object.assign(new Error(message), { status: 503 });
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

function load() {
  if (cache) return cache;
  const file = path.join(resolveArtifactDir(), "comparables.json");
  if (!fs.existsSync(file)) {
    throw fail("Comparable-listing index is missing; run export_runtime_index.py.");
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const byBucket = new Map();
  for (const bucket of parsed.localityBuckets || []) {
    byBucket.set(bucket.key, bucket);
  }
  const byCity = new Map();
  for (const city of parsed.cities || []) {
    byCity.set(city.city, city);
  }
  cache = { ...parsed, byBucket, byCity };
  return cache;
}

function bucketKey(city, locality, category) {
  return `${city}|${(locality || "__none__").toLowerCase()}|${category}`;
}

/**
 * Similarity between the request and one comparable sample. Deliberately
 * simple and explainable: area and bedroom count, the two things a buyer
 * actually compares, plus a penalty for a different category.
 */
function similarity(sample, input) {
  let score = 0;
  let weight = 0;

  const areaRatio = sample.areaSqFt / input.areaSqFt;
  // Within 15% area is a strong match; the penalty grows with log distance.
  score += Math.max(0, 1 - Math.abs(Math.log(areaRatio)) / Math.log(3));
  weight += 1;

  if (sample.bedrooms !== null && input.bedrooms !== null) {
    const diff = Math.abs(sample.bedrooms - input.bedrooms);
    score += Math.max(0, 1 - diff / 3);
    weight += 0.6;
  }

  if (sample.propertyCategory && sample.propertyCategory !== input.propertyCategory) {
    score *= 0.6;
  }
  return weight ? score / weight : 0;
}

/**
 * Find comparables for a normalised input.
 *
 * Falls back in clearly reported steps: exact locality+category bucket, then the
 * same city at any locality, then nothing. The caller reports which tier was
 * used, because "no comparables in this locality" is a meaningfully worse
 * signal than "comparables from across the city".
 */
export function findComparables(input, { limit = 6 } = {}) {
  const index = load();

  const exact = index.byBucket.get(
    bucketKey(input.city, input.locality, input.propertyCategory)
  );
  const city = index.byCity.get(input.city) || null;

  let tier = "locality";
  let bucket = exact;

  if (!bucket) {
    tier = "city";
    // Same city and category, largest buckets first: they have the most
    // observations behind the median, which is what makes a fallback honest.
    const candidates = (index.localityBuckets || [])
      .filter((b) => b.city === input.city && b.propertyCategory === input.propertyCategory)
      .sort((a, b) => b.n - a.n)
      .slice(0, 25);
    if (candidates.length) {
      bucket = candidates[0];
      tier = "city";
    }
  }

  if (!bucket) {
    return {
      tier: "none",
      bucket: null,
      samples: [],
      citySummary: city,
      count: 0,
    };
  }

  const ranked = (bucket.samples || [])
    .map((s) => ({ sample: s, score: similarity(s, input) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ sample, score }) => ({
      locality: bucket.locality,
      areaSqFt: sample.areaSqFt,
      bedrooms: sample.bedrooms,
      priceInr: sample.priceInr,
      pricePerSqFt: sample.pricePerSqFt,
      propertyCategory: sample.propertyCategory,
      targetType: sample.targetType,
      sourceKey: sample.sourceKey,
      licenseKey: sample.licenseKey,
      retrievedAt: sample.retrievedAt,
      projectName: sample.projectName ?? "",
      matchScore: Math.round(score * 100) / 100,
    }));

  return {
    tier: exact ? "locality" : tier,
    bucket: {
      key: bucket.key,
      locality: bucket.locality,
      city: bucket.city,
      propertyCategory: bucket.propertyCategory,
      n: bucket.n,
      medianPricePerSqFt: bucket.medianPricePerSqFt,
      p25PricePerSqFt: bucket.p25PricePerSqFt,
      p75PricePerSqFt: bucket.p75PricePerSqFt,
      minPricePerSqFt: bucket.minPricePerSqFt,
      maxPricePerSqFt: bucket.maxPricePerSqFt,
      medianTotalPriceInr: bucket.medianTotalPriceInr,
      medianAreaSqFt: bucket.medianAreaSqFt,
      medianBedrooms: bucket.medianBedrooms,
      sources: bucket.sources,
    },
    samples: ranked,
    citySummary: city,
    count: bucket.n,
  };
}

/** Localities the index actually has data for, for autocomplete. */
export function listLocalities(city, { limit = 200 } = {}) {
  const index = load();
  const seen = new Map();
  for (const b of index.localityBuckets || []) {
    if (city && b.city !== city) continue;
    if (!b.locality) continue;
    const prev = seen.get(b.locality);
    if (!prev || b.n > prev.n) seen.set(b.locality, b);
  }
  return Array.from(seen.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((b) => ({ locality: b.locality, n: b.n, medianPricePerSqFt: b.medianPricePerSqFt }));
}

export function clearComparablesCache() {
  globalThis.__estoviaComparablesCache = null;
}
