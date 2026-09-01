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
  landowner: { model: LandownerProfile, fields: ["identity", "address", "phone"] },
  builder: { model: BuilderProfile, fields: ["business", "pan", "gst", "mca", "address"] },
  supplier: { model: SupplierProfile, fields: ["business", "gst", "pan", "udyam", "address"] },
  buyer: { model: BuyerProfile, fields: ["identity", "address", "pan"] },
};

const REVIEWABLE = ["submitted", "under_review", "manual_review"];

/**
 * Build a flat queue of verification items across all role profiles.
 * Each item is a single field that needs admin review.
 */
export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status, role } = parseSearch(request.nextUrl.searchParams);
  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 30, 100);

  const items = [];

  const wantedRoles = role && PROFILE_MODELS[role] ? [role] : Object.keys(PROFILE_MODELS);

  for (const r of wantedRoles) {
    const { model, fields } = PROFILE_MODELS[r];
    const profiles = await model.find().sort({ updatedAt: -1 }).lean();
    const userIds = profiles.map((p) => p.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name username email accountStatus")
      .lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    for (const p of profiles) {
      const u = userById.get(String(p.userId));
      if (!u) continue;
      for (const field of fields) {
        let value;
        if (r === "landowner" && field === "identity") value = p.identityDocument?.status || "pending";
        else if (r === "landowner") value = u.verification?.[field] || "pending";
        else value = p.verification?.[field] || "pending";

        const matchesStatus =
          !status || status === "all"
            ? REVIEWABLE.includes(value)
            : value === status;
        if (!matchesStatus) continue;

        if (q) {
          const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
          if (!re.test(u.name) && !re.test(u.email) && !re.test(u.username)) continue;
        }

        items.push({
          role: r,
          profileId: p._id,
          userId: u._id,
          name: u.name || u.username,
          username: u.username,
          email: u.email,
          field,
          status: value,
          accountStatus: u.accountStatus || "active",
          updatedAt: p.updatedAt || p.createdAt || null,
        });
      }
    }
  }

  items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  const total = items.length;
  const pageItems = items.slice(skip, skip + limit);

  return ok({ items: pageItems, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});