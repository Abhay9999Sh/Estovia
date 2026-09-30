import mongoose from "mongoose";
import { VERIFICATION_STATUSES } from "@/lib/verification";

/**
 * The review record for ONE verification field.
 *
 * Statuses deliberately live in their own fixed paths (`verification.pan`,
 * `identityDocument.status`, `user.verification.phone`) because existing reads
 * across the app depend on them. This schema stores only the *review trail*:
 * why a decision was made, who made it, when, and what evidence was on file.
 *
 * It is mounted as a `Map` on `User` and on each role profile, keyed by the
 * verification field name, so every role shares one shape without each model
 * re-declaring every role's fields.
 */
const verificationItemSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "pending",
    },

    /**
     * Why the field was rejected, or what is still needed. Required by the API
     * whenever status is `rejected` or `needs_information`.
     */
    note: { type: String, default: "" },

    /** Short label for what was submitted, e.g. "GSTIN" or "Aadhaar". */
    evidence: { type: String, default: "" },
    evidenceLabel: { type: String, default: "" },

    /** Snapshot of the status before this review, for the "changed from" hint. */
    previousStatus: { type: String, default: "" },

    submittedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * Ready-to-mount `Map` field definition. `setMeta` in `@/lib/verification`
 * reads and writes it, handling both mongoose Maps and lean plain objects.
 */
export function verificationMetaField() {
  return {
    type: Map,
    of: verificationItemSchema,
    default: () => new Map(),
  };
}

export { verificationItemSchema };
export default verificationItemSchema;
