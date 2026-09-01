import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import LandListing from "@/lib/models/LandListing";
import User from "@/lib/models/User";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status, role } = parseSearch(request.nextUrl.searchParams);
  const filter = {};
  if (role === "all") {
    // no role filter
  } else if (role) {
    filter.status = role;
  }
  if (status) {
    const s = status === "all" ? "" : status;
    if (s) {
      if (["draft", "submitted", "under_review", "partially_verified", "verified", "rejected"].includes(s)) {
        filter.verificationStatus = s;
      } else if (["active", "paused", "sold", "rejected"].includes(s)) {
        filter.status = s;
      }
    }
  }
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: re }, { description: re }, { "location.address": re }, { "location.city": re }, { "location.state": re }];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);
  const [rows, total] = await Promise.all([
    LandListing.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("title ownerId pricing location area propertyType verificationStatus status reviewNotes views interestedUsers createdAt updatedAt")
      .lean(),
    LandListing.countDocuments(filter),
  ]);

  const owners = await User.find({ _id: { $in: rows.map((r) => r.ownerId) } }).select("name username email").lean();
  const uById = new Map(owners.map((o) => [String(o._id), o]));

  const items = rows.map((r) => ({
    ...r,
    owner: uById.get(String(r.ownerId)) || { name: "Unknown", username: "unknown" },
  }));

  return ok({ items, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});