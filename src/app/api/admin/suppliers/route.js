import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { withErrorHandling } from "@/lib/api";
import SupplierProfile from "@/lib/models/SupplierProfile";
import Order from "@/lib/models/Order";
import { readAllStatuses, readAllMeta, deriveOverall } from "@/lib/verification";
import { queryRoleList, listResponse } from "@/lib/adminVerificationQuery";

const ROLE = "supplier";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  // `status` carries the derived verification state, matching the other role
  // lists. Profile completion is a separate concern and has its own param,
  // because "pending" used to mean "onboarding incomplete" here and clashed
  // with the verification meaning of the same word.
  const profileFilter = (request.nextUrl.searchParams.get("profile") || "").trim();
  const extraMatch =
    profileFilter === "complete"
      ? { onboardingComplete: true }
      : profileFilter === "incomplete"
        ? { onboardingComplete: { $ne: true } }
        : null;

  const result = await queryRoleList({
    Model: SupplierProfile,
    role: ROLE,
    searchParams: request.nextUrl.searchParams,
    profileSearch: ["businessName", "ownerName", "fullName", "category", "gstin", "pan"],
    userSearch: ["name", "email", "username", "phone"],
    extraMatch,
  });

  const profileIds = result.docs.map((d) => d._id).filter(Boolean);
  const orderStats = await Order.aggregate([
    { $match: { supplierProfileId: { $in: profileIds } } },
    { $group: { _id: "$supplierProfileId", orders: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
  ]);
  const statsByProfile = new Map(orderStats.map((o) => [String(o._id), o]));

  return listResponse(result, (s, u) => {
    const verification = readAllStatuses(ROLE, s, u);
    return {
      userId: u._id,
      profileId: s._id,
      ...s,
      user: { _id: u._id, name: u.name, username: u.username, email: u.email, accountStatus: u.accountStatus },
      phone: u.phone || s.phone || "",
      createdAt: u.createdAt || s.createdAt || null,
      stats: statsByProfile.get(String(s._id)) || { orders: 0, revenue: 0 },
      profileCompleted: !!s.onboardingComplete,
      verification,
      verificationMeta: readAllMeta(ROLE, s, u),
      overall: deriveOverall(verification),
      verificationStatus: verification.business || "pending",
    };
  });
});
