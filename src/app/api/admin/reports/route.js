import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import Report from "@/lib/models/Report";
import User from "@/lib/models/User";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status } = parseSearch(request.nextUrl.searchParams);
  const filter = {};
  if (status && status !== "all") filter.status = status;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ subjectType: re }, { description: re }, { subjectId: re }];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);
  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Report.countDocuments(filter),
  ]);

  const reporters = await User.find({ _id: { $in: reports.map((r) => r.reporterId).filter(Boolean) } }).select("name username email").lean();
  const rById = new Map(reporters.map((r) => [String(r._id), r]));

  const byStatus = await Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);

  const items = reports.map((r) => ({
    ...r,
    reporter: rById.get(String(r.reporterId)) || null,
  }));

  return ok({ items, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)), byStatus });
});