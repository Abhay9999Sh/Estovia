import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import SupplierProfile from "@/lib/models/SupplierProfile";
import User from "@/lib/models/User";
import Order from "@/lib/models/Order";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status } = parseSearch(request.nextUrl.searchParams);
  const filter = {};
  if (status && status !== "all") {
    if (status === "verified") filter["verification.business"] = "verified";
    else if (status === "complete") filter.onboardingComplete = true;
    else if (status === "pending") filter.onboardingComplete = false;
  }
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ businessName: re }, { ownerName: re }, { fullName: re }, { category: re }, { gstin: re }, { pan: re }];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);
  const [suppliers, total] = await Promise.all([
    SupplierProfile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SupplierProfile.countDocuments(filter),
  ]);

  const [users, orders] = await Promise.all([
    User.find({ _id: { $in: suppliers.map((s) => s.userId).filter(Boolean) } }).select("name username email accountStatus").lean(),
    Order.aggregate([
      { $match: { supplierProfileId: { $in: suppliers.map((s) => s._id) } } },
      { $group: { _id: "$supplierProfileId", orders: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
    ]),
  ]);
  const uById = new Map(users.map((u) => [String(u._id), u]));
  const statByProfile = new Map(orders.map((o) => [String(o._id), o]));

  const items = suppliers.map((s) => ({
    ...s,
    user: uById.get(String(s.userId)) || null,
    stats: statByProfile.get(String(s._id)) || { orders: 0, revenue: 0 },
    verificationStatus: s.verification?.business || "pending",
  }));

  return ok({ items, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});