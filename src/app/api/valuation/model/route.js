import { requireRole } from "@/lib/auth";
import { ok, fail, withErrorHandling } from "@/lib/api";
import { describeModel, SUPPORTED_SEGMENT } from "@/lib/valuation";

/**
 * Model card: what is deployed, how well it actually performed, and what it
 * refuses to answer.
 *
 * Sends the measured holdout metrics, not the training-report numbers, and
 * carries the provenance string with them so the UI can say where they came
 * from. A client that trusts `metrics` is trusting the same replay that
 * `ml-service/scripts/verify_report_replay.py` checked.
 */
export const GET = withErrorHandling(async () => {
  const user = await requireRole(["landowner", "builder", "buyer", "admin", "viewer"]);

  const card = describeModel(SUPPORTED_SEGMENT);
  if (!card.available) {
    return fail("No valuation model is deployed.", 503);
  }

  return ok({
    model: card,
    // Roles are echoed so the UI can hide controls the user cannot use, rather
    // than relying on the server to reject them after the fact.
    roles: Array.isArray(user.roles) ? user.roles : [],
  });
});
