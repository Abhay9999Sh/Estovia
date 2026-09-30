import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

/**
 * GET /api/messaging/recipients?q=...
 * Searchable list of active non-admin users the current user can message.
 */
export const GET = withErrorHandling(async (request) => {
  const me = await requireAuth();
  await connectDB();

  const searchParams = request.nextUrl.searchParams;
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "15", 10) || 15, 40);

  const filter = {
    _id: { $ne: me._id },
    roles: { $ne: "admin" },
    accountStatus: { $in: ["active", "profile_pending", "profile_completed"] },
  };

  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { email: re }, { username: re }];
  }

  const users = await User.find(filter)
    .select("name username email avatar roles accountStatus profileCompleted")
    .sort({ name: 1 })
    .limit(limit)
    .lean();

  const recipients = users.map((u) => ({
    _id: u._id,
    name: u.name || u.username,
    username: u.username,
    email: u.email,
    avatar: u.avatar || null,
    roles: u.roles || [],
    primaryRole: (u.roles && u.roles[0]) || "viewer",
    profileCompleted: !!u.profileCompleted,
  }));

  return ok({ recipients });
});