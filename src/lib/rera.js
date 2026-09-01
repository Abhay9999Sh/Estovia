/**
 * RERA verification service.
 *
 * IMPORTANT: This module NEVER fakes a successful government verification.
 * If no authorized RERA data source is configured for the given state, the
 * registration is returned as "pending" / "manual_review" so the platform
 * shows an honest status (`Pending Verification` / `Manual Review`).
 *
 * A real integration can be plugged in later by implementing the
 * `lookup(state, registrationNumber)` branch against the applicable State/UT
 * RERA authority and returning normalized data.
 */

// Normalized verification result shape
// {
//   found: boolean,
//   status: "verified" | "not_found" | "mismatch" | "pending" | "manual_review" | "inactive",
//   registrationNumber,
//   promoterName,
//   projectName,
//   projectAddress,
//   registrationDate,
//   completionDate,
//   source,
//   verifiedAt,
// }

const RERA_API_URL = process.env.RERA_API_URL || "";
const RERA_API_KEY = process.env.RERA_API_KEY || "";

// Placeholder mapping of known RERA authority domains. Real per-state
// endpoints are intentionally not hardcoded here; integration is opt-in.
function authorityForState(state) {
  return null; // no wired integration yet -> manual_review/pending
}

/**
 * Verify a RERA registration number for a given state.
 *
 * Returns a normalized result. Because no external RERA API is currently
 * configured, results are always pending/manual_review (never "verified").
 */
export async function verifyReraRegistration({ state, registrationNumber }) {
  // Basic format sanity check is all we can do without a live source.
  const hasNumber = typeof registrationNumber === "string" && registrationNumber.trim().length > 0;

  const authority = authorityForState(state);

  if (!authority || !RERA_API_URL || !RERA_API_KEY) {
    // No integration configured for this state -> manual review required.
    return {
      found: false,
      status: hasNumber ? "manual_review" : "pending",
      registrationNumber: registrationNumber || "",
      promoterName: "",
      projectName: "",
      projectAddress: "",
      registrationDate: null,
      completionDate: null,
      source: "",
      verifiedAt: null,
    };
  }

  // A real API branch would be implemented here. Placeholder only.
  return {
    found: false,
    status: "manual_review",
    registrationNumber: registrationNumber || "",
    promoterName: "",
    projectName: "",
    projectAddress: "",
    registrationDate: null,
    completionDate: null,
    source: authority,
    verifiedAt: null,
  };
}
