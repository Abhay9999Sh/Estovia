/**
 * End-to-end smoke test for the valuation engine, runnable under plain Node.
 *
 *   node scripts/valuation_smoke.mjs
 *
 * Checks the things a unit test of the tree walk would miss: that a full request
 * produces a sane response, that refusals happen before the model is consulted,
 * and that the interval is actually calibrated rather than hard-coded.
 */

import assert from "node:assert/strict";

import { predict, describeModel } from "../src/lib/valuation/index.js";

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

console.log("\nmodel card");
const card = describeModel("builtup");
check("model is available", () => assert.equal(card.available, true));
check("serves verified metrics", () => {
  assert.equal(card.metricsProvenance, "verified-replay-of-exported-artefact");
  assert.ok(Math.abs(card.metrics.wape_pct - 43.68753729556652) < 1e-9);
  assert.ok(Math.abs(card.metrics.mae - 2714074.390317971) < 1e-6);
});
check("interval uses the verified q, not the stale artefact value", () => {
  assert.ok(Math.abs(card.interval.q - 0.8768559022935312) < 1e-12);
  assert.ok(Math.abs(card.interval.q - 0.819143720703125) > 0.01, "stale q leaked in");
});
check("land is reported as untrained, from the registry not a hardcoded list", () => {
  assert.deepEqual(card.segmentsNotTrained, ["land"]);
  assert.deepEqual(card.segmentsObserved, ["builtup", "land"]);
});
check("categories come from the artefact's own category_stats", () => {
  assert.deepEqual(card.supportedCategories, ["apartment", "independent_house", "villa"]);
  assert.ok(card.categoriesNotCovered.includes("land_residential"));
  assert.ok(card.categoriesNotCovered.includes("commercial_unit"));
});
check("importance is split-count based and sums to <= 100", () => {
  assert.ok(card.importance.length > 0);
  const total = card.importance.reduce((a, f) => a + f.splitPct, 0);
  assert.ok(total <= 100.0001, `top-12 share ${total}`);
});

console.log("\nprediction: typical Noida apartment");
const good = predict({
  propertyCategory: "apartment",
  city: "Noida",
  locality: "sector 150",
  areaSqFt: 1450,
  areaUnit: "sqft",
  bedrooms: 3,
  bathrooms: 3,
  balconies: 2,
  floorNumber: 7,
  totalFloors: 12,
  propertyAgeYears: 4,
  liftAvailable: "yes",
  parkingCount: 1,
  furnishing: "semi_furnished",
  facing: "north",
  transactionType: "resale",
  ownership: "freehold",
});
check("status is ok", () => assert.equal(good.status, "ok"));
check("produces a positive estimate", () => {
  assert.ok(good.result.valueInr > 0);
  assert.ok(good.result.pricePerSqFt > 0);
});
check("band brackets the estimate", () => {
  assert.ok(good.result.lowInr < good.result.valueInr);
  assert.ok(good.result.highInr > good.result.valueInr);
});
check("band width matches q", () => {
  const lowRatio = good.result.valueInr - good.result.lowInr;
  const highRatio = good.result.highInr - good.result.valueInr;
  const q = good.coverage.intervalQ;
  assert.ok(Math.abs(lowRatio / good.result.valueInr - q) < 1e-3);
  assert.ok(Math.abs(highRatio / good.result.valueInr - q) < 1e-3);
});
check("estimate is in a believable range for NCR asking prices", () => {
  const ppsf = good.result.pricePerSqFt;
  assert.ok(ppsf > 2000 && ppsf < 30000, `ppsf=${ppsf}`);
});
check("exposes verified metrics with provenance", () => {
  assert.equal(good.modelMeta.metricsProvenance, "verified-replay-of-exported-artefact");
  assert.ok(good.modelMeta.metrics.n === 1418);
});
check("states the target is asking price, not a sale price", () => {
  assert.match(good.modelMeta.targetSemantics, /NOT a registered transaction price/);
});
check("comparables are real asking-price records", () => {
  const c = good.explainability.comparables;
  assert.ok(Array.isArray(c));
  for (const s of c) {
    assert.equal(s.targetType, "asking_price");
    assert.ok(s.priceInr > 0);
  }
});
check("limitations disclose the measured error and the missing geo data", () => {
  const text = good.explainability.limitations.join(" ");
  assert.match(text, /43\.7%/);
  assert.match(text, /geospatial/i);
  assert.match(text, /asking price/i);
});
check("factors are explained and carry a direction", () => {
  assert.ok(good.explainability.factors.length > 0);
  for (const f of good.explainability.factors) {
    assert.ok(f.label && f.label !== f.key, `missing label for ${f.key}`);
    assert.ok(["increase", "decrease", "neutral"].includes(f.direction));
  }
});

console.log("\nunit conversion changes the estimate predictably");
const sqm = predict({ ...good.inputSnapshot, areaSqFt: 134.7, areaUnit: "sqm" });
check("1450 sqft == 134.7 sqm", () => {
  assert.ok(Math.abs(sqm.result.valueInr / good.result.valueInr - 1) < 0.02);
});

console.log("\nrefusals happen before inference");
check("land is refused, not guessed", () => {
  const r = predict({ propertyCategory: "land_residential", city: "Noida", areaSqFt: 2000 });
  assert.equal(r.status, "unsupported_category");
  assert.match(r.message, /not supported/i);
  assert.equal(r.coverage.coverageLevel, "unsupported");
  assert.equal(r.result.valueInr, undefined);
});
check("commercial is refused", () => {
  const r = predict({ propertyCategory: "commercial_unit", city: "Noida", areaSqFt: 2000 });
  assert.equal(r.status, "unsupported_category");
});
check("a city outside the training geography is refused", () => {
  const r = predict({ propertyCategory: "apartment", city: "Mumbai", areaSqFt: 1200, bedrooms: 2 });
  assert.equal(r.status, "unsupported_location");
  assert.match(r.message, /Delhi NCR/);
});
check("missing area is a validation error, not a NaN price", () => {
  assert.throws(
    () => predict({ propertyCategory: "apartment", city: "Noida" }),
    (e) => e.status === 400
  );
});
check("absurd area is rejected", () => {
  assert.throws(
    () => predict({ propertyCategory: "apartment", city: "Noida", areaSqFt: 9e9 }),
    (e) => e.status === 400
  );
});
check("absurd bedroom count is rejected", () => {
  assert.throws(
    () => predict({ propertyCategory: "apartment", city: "Noida", areaSqFt: 1200, bedrooms: 99 }),
    (e) => e.status === 400
  );
});

console.log("\nunseen locality is flagged, not silently wrong");
const unseen = predict({
  propertyCategory: "apartment",
  city: "Noida",
  locality: "a place that is not in the training data at all",
  areaSqFt: 1200,
  bedrooms: 2,
});
check("flags the unseen locality", () => {
  assert.ok(unseen.flags.includes("unseen_locality"));
  assert.ok(unseen.coverage.coverageLevel === "low" || unseen.coverage.coverageLevel === "limited");
  assert.ok(unseen.coverage.coverageReasons.length > 0);
});
check("always discloses that geospatial data was unavailable", () => {
  assert.ok(unseen.flags.includes("no_geospatial_data"));
});
check("model estimate and the user's ask never share a field", () => {
  const withAsk = predict(
    { propertyCategory: "apartment", city: "Noida", locality: "sector 150", areaSqFt: 1450, bedrooms: 3 },
    { askingPriceInr: 9500000, askingPriceType: "asking_price", comparingField: "listing" }
  );
  assert.equal(withAsk.askComparison.askingPriceInr, 9500000);
  assert.equal(withAsk.result.valueInr !== 9500000, true);
  assert.ok(withAsk.askComparison.differenceInr !== 0);
  assert.match(withAsk.askComparison.comparisonBasis, /not a sale price/);
});

console.log("\nsnapshot records what was imputed");
check("missing inputs are listed for the UI", () => {
  const r = predict({ propertyCategory: "apartment", city: "Noida", locality: "sector 150", areaSqFt: 1450 });
  assert.ok(r.inputSnapshot.missingInputs.includes("bedrooms"));
  assert.ok(r.inputSnapshot.missingInputs.includes("furnishing"));
  assert.equal(r.inputSnapshot.geoDataAvailable, false);
});

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
