import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import Order from "@/lib/models/Order";
import SupplierProfile from "@/lib/models/SupplierProfile";
import User from "@/lib/models/User";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status } = parseSearch(request.nextUrl.searchParams);
  const filter = {};
  if (status && status !== "all") filter.status = status;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ orderNumber: re }, { deliveryAddress: re }, { terms: re }];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  const [suppliers, builders] = await Promise.all([
    SupplierProfile.find({ _id: { $in: orders.map((o) => o.supplierProfileId).filter(Boolean) } }).select("businessName ownerName").lean(),
    User.find({ _id: { $in: orders.map((o) => o.builderId).filter(Boolean) } }).select("name username email").lean(),
  ]);

  const sById = new Map(suppliers.map((s) => [String(s._id), s]));
  const uById = new Map(builders.map((b) => [String(b._id), b]));

  const byStatus = await Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const totalValue = await Order.aggregate([{ $group: { _id: null, value: { $sum: "$totalAmount" } } }]);

  const items = orders.map((o) => ({
    ...o,
    supplier: sById.get(String(o.supplierProfileId)) || null,
    builder: uById.get(String(o.builderId)) || null,
  }));

  return ok({
    items,
    total,
    page,
    limit,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    byStatus,
    totalValue: totalValue[0]?.value || 0,
  });
});