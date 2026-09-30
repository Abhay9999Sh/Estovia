import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { withErrorHandling } from "@/lib/api";
import BuyerProfile from "@/lib/models/BuyerProfile";
import { readAllStatuses, readAllMeta, deriveOverall } from "@/lib/verification";
import { queryRoleList, listResponse } from "@/lib/adminVerificationQuery";

const ROLE = "buyer";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const result = await queryRoleList({
    Model: BuyerProfile,
    role: ROLE,
    searchParams: request.nextUrl.searchParams,
    profileSearch: ["fullName", "email", "pan"],
    userSearch: ["name", "email", "username", "phone"],
  });

  return listResponse(result, (p, u) => {
    const verification = readAllStatuses(ROLE, p, u);
    return {
      userId: u._id,
      name: u.name || p.fullName || u.username,
      email: u.email,
      username: u.username,
      phone: u.phone || p.phone || "",
      accountStatus: u.accountStatus || "active",
      createdAt: u.createdAt || p.createdAt || null,
      buyerType: p.buyerType || "",
      pan: p.pan || "",
      profileCompleted: !!p.onboardingComplete,
      verification,
      verificationMeta: readAllMeta(ROLE, p, u),
      overall: deriveOverall(verification),
    };
  });
});
