import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import User from "@/lib/models/User";
import BuilderProfile from "@/lib/models/BuilderProfile";
import SupplierProfile from "@/lib/models/SupplierProfile";
import BuyerProfile from "@/lib/models/BuyerProfile";
import LandownerProfile from "@/lib/models/LandownerProfile";

const PROFILE_MODELS = {
  landowner: LandownerProfile,
  builder: BuilderProfile,
  supplier: SupplierProfile,
  buyer: BuyerProfile,
};

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status, role } = parseSearch(request.nextUrl.searchParams);
  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);

  const filter = {};

  if (role === "all") {
    filter.roles = { $nin: ["admin"] };
  } else if (role) {
    const validRoles = ["viewer", "landowner", "builder", "supplier", "buyer", "admin"];
    if (validRoles.includes(role)) filter.roles = role;
  }

  if (status) {
    if (status === "all") {
      // no-op — every account status
    } else if (["active", "suspended", "deactivated"].includes(status)) {
      filter.accountStatus = status;
    } else if (status === "profile_pending") {
      filter.profileCompleted = false;
    } else if (status === "profile_completed") {
      filter.profileCompleted = true;
    }
  }

  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { username: re }, { email: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("name username email roles profileCompleted accountStatus avatar createdAt verification")
      .lean(),
    User.countDocuments(filter),
  ]);

  // Attach role-profile completeness for the numeric preview.
  const userIds = users.map((u) => u._id);
  const profCounts = {};
  for (const [r, Model] of Object.entries(PROFILE_MODELS)) {
    const docs = await Model.find({ userId: { $in: userIds } })
      .select("userId onboardingComplete")
      .lean();
    for (const d of docs) {
      profCounts[String(d.userId)] = {
        role: r,
        onboardingComplete: !!d.onboardingComplete,
      };
    }
  }

  const enriched = users.map((u) => ({
    ...u,
    profile: profCounts[String(u._id)] || null,
  }));

  return ok({ users: enriched, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});