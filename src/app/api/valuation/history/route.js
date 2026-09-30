import { requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import ValuationPrediction from "@/lib/models/ValuationPrediction";
import { ok, fail, withErrorHandling } from "@/lib/api";

const ROLES = ["landowner", "builder", "buyer", "admin", "viewer"];

/**
 * Mirrors the resultSchema status enum in ValuationPrediction.js. Guarding
 * ?status= keeps a typo from silently returning an empty history.
 */
const STATUSES = [
  "ok",
  "unsupported_location",
  "unsupported_category",
  "no_model_for_segment",
  "insufficient_data",
  "out_of_distribution",
  "invalid_input",
];

/**
 * The caller's own valuation history, newest first.
 *
 * Scoped to the requesting user. Admin sees everyone's; every other role sees
 * only their own records, because a valuation snapshot can reveal what someone
 * is thinking about a property they have not listed publicly.
 */
export const GET = withErrorHandling(async (request) => {
  const user = await requireRole(ROLES);
  const { searchParams } = new URL(request.url);

  if (process.env.VALUATION_STORE_PREDICTIONS === "false") {
    return fail("Valuation history is disabled on this deployment.", 404);
  }

  const isAdmin = Array.isArray(user.roles) && user.roles.includes("admin");
  // Clamp: a negative or fractional limit/page would make skip() throw in Mongo.
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
  const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(rawPage) ? Math.max(rawPage, 1) : 1;
  const status = searchParams.get("status");

  if (status && !STATUSES.includes(status)) {
    return fail(`Unknown status "${status}". Expected one of: ${STATUSES.join(", ")}.`, 400);
  }

  const filter = isAdmin && searchParams.get("all") === "1" ? {} : { requestedBy: user._id };
  // Status lives inside the nested result document, not at the top level.
  if (status) filter["result.status"] = status;

  await connectDB();
  const [records, total] = await Promise.all([
    ValuationPrediction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "result coverage inputSnapshot modelMeta askComparison valuationDate requestContext createdAt listingRef unitRef projectRef"
      )
      .lean(),
    ValuationPrediction.countDocuments(filter),
  ]);

  if (records.length === 0 && page === 1) {
    return fail("You have no saved valuations yet.", 404);
  }

  return ok({
    valuations: records.map((r) => ({
      id: String(r._id),
      status: r.result?.status,
      valueInr: r.result?.valueInr ?? null,
      lowInr: r.result?.lowInr ?? null,
      highInr: r.result?.highInr ?? null,
      pricePerSqFt: r.result?.pricePerSqFt ?? null,
      currency: r.result?.currency || "INR",
      city: r.inputSnapshot?.city || "",
      locality: r.inputSnapshot?.locality || "",
      propertyCategory: r.inputSnapshot?.propertyCategory || "",
      areaSqFt: r.inputSnapshot?.areaSqFt ?? null,
      bedrooms: r.inputSnapshot?.bedrooms ?? null,
      coverageLevel: r.coverage?.coverageLevel || "low",
      coverageLabel: r.coverage?.coverageLabel || "",
      modelId: r.modelMeta?.modelId || "",
      askingPriceInr: r.askComparison?.askingPriceInr ?? null,
      differencePct: r.askComparison?.differencePct ?? null,
      requestContext: r.requestContext,
      valuationDate: r.valuationDate,
      createdAt: r.createdAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
