import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { audit } from "@/lib/audit";
import mongoose from "mongoose";
import Project from "@/lib/models/Project";
import User from "@/lib/models/User";
import ProjectUnit from "@/lib/models/ProjectUnit";

export const GET = withErrorHandling(async (request, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Invalid project.", 400);
  await connectDB();

  const project = await Project.findById(id).lean();
  if (!project) return fail("Project not found.", 404);
  const [builder, units, requirements, orders, inquiries] = await Promise.all([
    User.findById(project.builderId).select("name username email phone").lean(),
    ProjectUnit.find({ projectId: id }).sort({ createdAt: -1 }).lean(),
    import("@/lib/models/SupplierRequirement").then(({ default: M }) => M.find({ projectId: id }).sort({ createdAt: -1 }).limit(20).lean()),
    import("@/lib/models/Order").then(({ default: M }) => M.find({ projectId: id }).sort({ createdAt: -1 }).limit(20).lean()),
    import("@/lib/models/BuyerInquiry").then(({ default: M }) => M.find({ projectId: id }).sort({ createdAt: -1 }).limit(20).lean()),
  ]);

  return ok({ project, builder, units, requirements, orders, inquiries, documents: await import("@/lib/models/ProjectDocument").then(({ default: M }) => M.find({ projectId: id }).sort({ createdAt: -1 }).lean()) });
});

// Read-only oversight: only the dashboard is allowed to update PRR/RERA markers if ever needed.
export const PATCH = withErrorHandling(async (request, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Invalid project.", 400);

  const body = await request.json();
  const action = String(body.action || "");
  await connectDB();

  const project = await Project.findById(id);
  if (!project) return fail("Project not found.", 404);

  const allowedFlags = ["markReraVerified"];
  if (!allowedFlags.includes(action)) return fail("This project field is read-only for admin oversight.", 403);

  if (action === "markReraVerified") {
    project.rera.status = "verified";
    project.rera.verifiedAt = new Date();
    audit({ actor: admin._id, actorRole: "admin", entity: "project", entityId: String(project._id), action: "project_rera_verified", previousStatus: "pending", newStatus: "verified" });
  }

  await project.save();
  return ok({ project, message: "Project RERA status updated." });
});