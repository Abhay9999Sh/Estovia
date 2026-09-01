import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import ProjectUnit from "@/lib/models/ProjectUnit";
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
    filter.$or = [{ unitNumber: re }, { tower: re }, { configuration: re }, { unitType: re }];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);
  const [units, total] = await Promise.all([
    ProjectUnit.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ProjectUnit.countDocuments(filter),
  ]);

  const [projects, builders] = await Promise.all([
    Project.find({ _id: { $in: units.map((u) => u.projectId).filter(Boolean) } }).select("name city state projectType").lean(),
    User.find({ _id: { $in: units.map((u) => u.builderId).filter(Boolean) } }).select("name username email").lean(),
  ]);
  const pById = new Map(projects.map((p) => [String(p._id), p]));
  const uById = new Map(builders.map((b) => [String(b._id), b]));
  const byStatus = await ProjectUnit.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);

  const items = units.map((u) => ({
    ...u,
    project: pById.get(String(u.projectId)) || null,
    builder: uById.get(String(u.builderId)) || null,
  }));

  return ok({ items, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)), byStatus });
});