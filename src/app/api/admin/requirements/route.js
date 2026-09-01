import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import Project from "@/lib/models/Project";
import User from "@/lib/models/User";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status } = parseSearch(request.nextUrl.searchParams);
  const filter = {};
  if (status && status !== "all") filter.status = status;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: re }, { category: re }, { deliveryLocation: re }, { description: re }];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);
  const [requirements, total] = await Promise.all([
    SupplierRequirement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SupplierRequirement.countDocuments(filter),
  ]);

  const [projects, builders, quotations] = await Promise.all([
    Project.find({ _id: { $in: requirements.map((r) => r.projectId).filter(Boolean) } }).select("name city state").lean(),
    User.find({ _id: { $in: requirements.map((r) => r.builderId).filter(Boolean) } }).select("name username email").lean(),
    import("@/lib/models/Quotation").then(({ default: M }) => M.aggregate([
      { $match: { requirementId: { $in: requirements.map((r) => r._id) } } },
      { $group: { _id: "$requirementId", count: { $sum: 1 } } },
    ])),
  ]);

  const pById = new Map(projects.map((p) => [String(p._id), p]));
  const uById = new Map(builders.map((b) => [String(b._id), b]));
  const qCountById = new Map(quotations.map((q2) => [String(q2._id), q2.count]));

  const items = requirements.map((r) => ({
    ...r,
    project: pById.get(String(r.projectId)) || null,
    builder: uById.get(String(r.builderId)) || null,
    quotationCount: qCountById.get(String(r._id)) || 0,
  }));

  return ok({ items, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});