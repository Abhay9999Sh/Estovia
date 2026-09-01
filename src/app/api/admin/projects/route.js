import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import Project from "@/lib/models/Project";
import User from "@/lib/models/User";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status } = parseSearch(request.nextUrl.searchParams);
  const filter = {};
  const validStatuses = ["Planning", "Land Acquisition", "Documentation", "Approvals", "Under Construction", "Completed", "On Hold", "Cancelled"];
  if (status && status !== "all" && validStatuses.includes(status)) filter.status = status;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { name: re },
      { "location.city": re },
      { "location.state": re },
      { projectType: re },
      { description: re },
    ];
  }

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 20, 100);
  const [projects, total] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Project.countDocuments(filter),
  ]);

  const builders = await User.find({ _id: { $in: projects.map((p) => p.builderId).filter(Boolean) } }).select("name username email").lean();
  const uById = new Map(builders.map((b) => [String(b._id), b]));

  const items = projects.map((p) => ({
    ...p,
    builder: uById.get(String(p.builderId)) || { name: "Unknown", username: "unknown" },
  }));

  return ok({ items, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});