import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { withErrorHandling } from "@/lib/api";
import BuilderProfile from "@/lib/models/BuilderProfile";
import { readAllStatuses, readAllMeta, deriveOverall } from "@/lib/verification";
import { queryRoleList, listResponse } from "@/lib/adminVerificationQuery";

const ROLE = "builder";

/** RERA registrations are a separate document system, surfaced as a pseudo-field. */
function reraStatus(profile) {
  const regs = profile?.reraRegistrations || [];
  if (!regs.length) return "pending";
  if (regs.some((r) => r.status === "verified")) return "verified";
  if (regs.some((r) => ["pending", "submitted", "under_review", "manual_review"].includes(r.status))) return "under_review";
  if (regs.some((r) => ["rejected", "not_found", "mismatch"].includes(r.status))) return "rejected";
  return "pending";
}

/**
 * Field-status predicates that mirror `reraStatus` exactly. "Pending" means no
 * registration has been filed at all - a registration itself sitting in
 * `pending` maps to "under_review" in the JS above, so it must not match here.
 */
function reraFilter(stat) {
  const reraStatuses = ["pending", "submitted", "under_review", "manual_review"];
  const rejectedStatuses = ["rejected", "not_found", "mismatch"];
  if (stat === "pending") {
    return {
      $or: [
        { reraRegistrations: { $exists: false } },
        { reraRegistrations: { $size: 0 } },
      ],
    };
  }
  if (stat === "verified") return { reraRegistrations: { $elemMatch: { status: "verified" } } };
  if (stat === "under_review") return { reraRegistrations: { $elemMatch: { status: { $in: reraStatuses } } } };
  if (stat === "rejected") return { reraRegistrations: { $elemMatch: { status: { $in: rejectedStatuses } } } };
  return { reraRegistrations: { $elemMatch: { status: stat } } };
}

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const result = await queryRoleList({
    Model: BuilderProfile,
    role: ROLE,
    searchParams: request.nextUrl.searchParams,
    profileSearch: ["companyName", "fullName", "email", "businessEmail", "gstin", "pan", "cin", "llpin"],
    userSearch: ["name", "email", "username", "phone"],
    onFieldFilter: (field, stat, add) => {
      if (field === "rera") add(reraFilter(stat));
    },
  });

  return listResponse(result, (p, u) => {
    const verification = readAllStatuses(ROLE, p, u);
    return {
      userId: u._id,
      name: u.name || p.fullName || p.companyName || u.username,
      email: u.email,
      username: u.username,
      phone: u.phone || p.phone || p.businessPhone || "",
      accountStatus: u.accountStatus || "active",
      createdAt: u.createdAt || p.createdAt || null,
      companyName: p.companyName || "",
      businessType: p.businessType || "",
      designation: p.designation || "",
      gstin: p.gstin || "",
      pan: p.pan || "",
      yearsOfExperience: p.yearsOfExperience || 0,
      completedProjects: p.completedProjects || 0,
      profileCompleted: !!p.onboardingComplete,
      verification,
      verificationMeta: readAllMeta(ROLE, p, u),
      rera: reraStatus(p),
      overall: deriveOverall(verification),
    };
  });
});
