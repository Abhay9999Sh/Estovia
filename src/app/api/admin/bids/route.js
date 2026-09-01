import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import Quotation from "@/lib/models/Quotation";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
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
    filter.$or = [{ paymentTerms: re }, { notes: re }];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);
  const [quotations, total] = await Promise.all([
    Quotation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Quotation.countDocuments(filter),
  ]);

  const [requirements, suppliers, builders] = await Promise.all([
    SupplierRequirement.find({ _id: { $in: quotations.map((q2) => q2.requirementId).filter(Boolean) } }).select("title status").lean(),
    SupplierProfile.find({ _id: { $in: quotations.map((q2) => q2.supplierProfileId).filter(Boolean) } }).select("businessName ownerName").lean(),
    User.find({ _id: { $in: quotations.map((q2) => q2.builderId).filter(Boolean) } }).select("name username email").lean(),
  ]);

  const rById = new Map(requirements.map((r) => [String(r._id), r]));
  const sById = new Map(suppliers.map((s) => [String(s._id), s]));
  const uById = new Map(builders.map((b) => [String(b._id), b]));

  const items = quotations.map((q2) => ({
    ...q2,
    requirement: rById.get(String(q2.requirementId)) || null,
    supplier: sById.get(String(q2.supplierProfileId)) || null,
    builder: uById.get(String(q2.builderId)) || null,
  }));

  return ok({ items, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});