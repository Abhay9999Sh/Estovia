import { createHash } from "crypto";

import { requireRole } from "@/lib/auth";
import { getSessionToken } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import ValuationPrediction from "@/lib/models/ValuationPrediction";
import { ok, fail, withErrorHandling } from "@/lib/api";
import { predict, SUPPORTED_SEGMENT } from "@/lib/valuation";

/** Every role that may ask for a valuation. */
const ROLES = ["landowner", "builder", "buyer", "admin", "viewer"];

const REQUEST_CONTEXTS = [
  "landowner_listing_form",
  "landowner_dashboard",
  "builder_project",
  "builder_unit",
  "buyer_property_detail",
  "standalone_estimate",
  "admin_tool",
];

function bucketFor(token) {
  // A stable, non-reversible bucket key. The raw token is a bearer credential,
  // so it must never be stored, and we deliberately do not fall back to an IP.
  if (!token) return "";
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function storePredictions() {
  return process.env.VALUATION_STORE_PREDICTIONS !== "false";
}

function rateLimitPerHour() {
  const n = Number(process.env.VALUATION_RATE_LIMIT_PER_HOUR);
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

/**
 * Rate limit by counting the caller's own saved valuations from the last hour.
 *
 * Counting rows rather than keeping an in-memory counter is deliberate: a
 * serverless deployment runs many instances, so a per-process counter would let
 * one user multiply their quota by however many instances handled the traffic.
 * This uses the existing (requestedBy, createdAt) index.
 *
 * This bounds *stored* rows, not compute, and it fails open if the database is
 * unreachable: the caller still gets an estimate. That is deliberate. Inference
 * is 1,200 in-process tree comparisons with no per-call external cost, so
 * denying an estimate because the audit store is down costs users more than it
 * protects. Do not treat this as an abuse control.
 */
async function withinRateLimit(userId) {
  const limit = rateLimitPerHour();
  if (limit === 0) return true;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const used = await ValuationPrediction.countDocuments({
    requestedBy: userId,
    createdAt: { $gte: since },
  });
  return used < limit;
}

/** Shape a prediction into the columns ValuationPrediction actually stores. */
function toRecord(result, ctx) {
  return {
    requestedBy: ctx.userId,
    listingRef: ctx.listingId,
    unitRef: ctx.unitId,
    projectRef: ctx.projectId,
    requestContext: ctx.requestContext,
    sessionId: ctx.sessionId,
    engineVersion: process.env.VALUATION_ENGINE_VERSION || "valuation.v1",
    modelMeta: result.modelMeta
      ? {
          modelId: result.modelMeta.modelId,
          modelVersion: result.modelMeta.modelVersion,
          segment: result.modelMeta.segment,
          estimator: result.modelMeta.estimator,
          trainedAt: result.modelMeta.trainedAt,
          featureSchemaVersion: result.modelMeta.featureSchemaVersion,
          target: result.modelMeta.target,
          targetSemantics: result.modelMeta.targetSemantics,
        }
      : { modelId: "", segment: SUPPORTED_SEGMENT },
    inputSnapshot: result.inputSnapshot,
    result: {
      status: result.result.status,
      valueInr: result.result.valueInr ?? null,
      lowInr: result.result.lowInr ?? null,
      highInr: result.result.highInr ?? null,
      pricePerSqFt: result.result.pricePerSqFt ?? null,
      currency: result.result.currency,
      message: result.result.message,
    },
    coverage: {
      intervalMethod: result.coverage.intervalMethod,
      intervalAlpha: result.coverage.intervalAlpha ?? null,
      intervalQ: result.coverage.intervalQ ?? null,
      intervalNominalCoveragePct: result.coverage.intervalNominalCoveragePct ?? null,
      intervalMeasuredCoveragePct: result.coverage.intervalMeasuredCoveragePct ?? null,
      intervalNCalibration: result.coverage.intervalNCalibration ?? null,
      coverageLevel: result.coverage.coverageLevel,
      coverageLabel: result.coverage.coverageLabel,
      comparableCount: result.coverage.comparableCount,
      localityObservations: result.coverage.localityObservations,
      coverageReasons: result.coverage.coverageReasons,
    },
    explainability: {
      explanationMethod: result.explainability.explanationMethod,
      factors: result.explainability.factors,
      comparableCount: result.explainability.comparableCount,
      comparables: result.explainability.comparables,
      limitations: result.explainability.limitations,
    },
    askComparison: result.askComparison,
    valuationDate: new Date(),
  };
}

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(ROLES);
  const body = await request.json();

  let result;
  try {
    result = predict(body, {
      askingPriceInr: body.askingPriceInr,
      askingPriceType: body.askingPriceType,
      comparingField: body.comparingField,
    });
  } catch (error) {
    // Handled here rather than left to the generic wrapper, which collapses every
    // non-401/403 status into a generic 500. A bad field is a 400 with a message
    // the user can act on, not an opaque server error.
    if (error.status === 400) {
      return fail(error.message, 400, error.field ? { field: error.field } : {});
    }
    throw error;
  }

  const shouldStore = storePredictions();
  let record = null;

  try {
    await connectDB();

    if (shouldStore && !(await withinRateLimit(user._id))) {
      return fail(
        `You have reached the limit of ${rateLimitPerHour()} valuations per hour. Please try again later.`,
        429
      );
    }

    if (shouldStore) {
      record = await ValuationPrediction.create(
        toRecord(result, {
          userId: user._id,
          listingId: body.listingId || null,
          unitId: body.unitId || null,
          projectId: body.projectId || null,
          requestContext: REQUEST_CONTEXTS.includes(body.requestContext)
            ? body.requestContext
            : "standalone_estimate",
          sessionId: bucketFor(await getSessionToken()),
        })
      );
    }
  } catch (error) {
    // The estimate is already computed and correct. Failing to archive it must
    // not turn a successful valuation into an error response, so log and carry
    // on; the user still gets their number.
    console.error("Valuation could not be archived:", error);
  }

  return ok(
    {
      valuation: result,
      saved: Boolean(record),
      savedId: record ? record._id : null,
    },
    201
  );
});
