import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import SupplierProduct from "@/lib/models/SupplierProduct";
import SupplierProfile from "@/lib/models/SupplierProfile";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status } = parseSearch(request.nextUrl.searchParams);
  const filter = {};
  if (status === "active") filter.isActive = true;
  else if (status === "inactive") filter.isActive = false;
  else if (status === "verified") filter.isVerified = true;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { category: re }, { subcategory: re }, { brand: re }];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);
  const [products, total] = await Promise.all([
    SupplierProduct.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SupplierProduct.countDocuments(filter),
  ]);

  const suppliers = await SupplierProfile.find({ _id: { $in: products.map((p) => p.supplierId).filter(Boolean) } }).select("businessName ownerName").lean();
  const sById = new Map(suppliers.map((s) => [String(s._id), s]));

  const items = products.map((p) => ({
    ...p,
    supplier: sById.get(String(p.supplierId)) || null,
  }));

  return ok({ items, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});