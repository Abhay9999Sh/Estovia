import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import AuditLog from "@/lib/models/AuditLog";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status, role } = parseSearch(request.nextUrl.searchParams);
  const filter = {};
  if (role && role !== "all") filter.actorRole = role;
  if (status && status !== "all") filter.action = { $regex: new RegExp(status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ action: re }, { entity: re }, { reason: re }, { entityId: re }];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 40, 200);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  const byAction = await AuditLog.aggregate([{ $group: { _id: "$action", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }]);

  return ok({ logs, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)), byAction });
});