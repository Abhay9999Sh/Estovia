import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import ProjectDocument from "@/lib/models/ProjectDocument";
import MaterialRequirement from "@/lib/models/MaterialRequirement";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";

const PROJECT_TYPES = ["Residential", "Commercial", "Industrial", "Mixed Use", "Plotted Development", "Township", "Other"];
const PROJECT_STATUSES = ["Planning", "Land Acquisition", "Documentation", "Approvals", "Under Construction", "Completed", "On Hold", "Cancelled"];

// Allowed status transitions (guarded server-side)
const STATUS_TRANSITIONS = {
  Planning: ["Land Acquisition", "Documentation", "On Hold", "Cancelled"],
  "Land Acquisition": ["Documentation", "Approvals", "On Hold", "Cancelled"],
  Documentation: ["Approvals", "On Hold", "Cancelled"],
  Approvals: ["Under Construction", "On Hold", "Cancelled"],
  "Under Construction": ["Completed", "On Hold", "Cancelled"],
  Completed: [],
  "On Hold": ["Planning", "Land Acquisition", "Documentation", "Approvals", "Under Construction", "Cancelled"],
  Cancelled: [],
};

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);

  await connectDB();
  const project = await Project.findById(id)
    .populate("landId", "title location pricing area verificationStatus status images")
    .populate("landownerId", "name avatar username")
    .lean();

  if (!project) return fail("Project not found.", 404);
  if (String(project.builderId) !== String(user._id)) {
    return fail("You are not authorized to access this project.", 403);
  }

  const [documents, materialRequirements] = await Promise.all([
    ProjectDocument.find({ projectId: id }).lean(),
    MaterialRequirement.find({ projectId: id }).lean(),
  ]);

  return ok({ project, documents, materialRequirements });
});

export const PATCH = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);

  const body = await request.json();
  await connectDB();

  const project = await Project.findById(id);
  if (!project) return fail("Project not found.", 404);
  if (String(project.builderId) !== String(user._id)) {
    return fail("You are not authorized to edit this project.", 403);
  }

  const update = {};

  if (body.name !== undefined) update.name = sanitizeText(body.name, 160);
  if (body.description !== undefined) update.description = sanitizeText(body.description, 5000);
  if (body.projectType !== undefined)
    update.projectType = PROJECT_TYPES.includes(body.projectType) ? body.projectType : project.projectType;
  if (body.estimatedBudget !== undefined) update.estimatedBudget = Math.max(0, Number(body.estimatedBudget) || 0);
  if (body.startDate !== undefined) update.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.completionDate !== undefined) update.completionDate = body.completionDate ? new Date(body.completionDate) : null;
  if (body.images !== undefined) update.images = Array.isArray(body.images) ? body.images.slice(0, 10) : [];

  // Controlled status transitions
  if (body.status !== undefined) {
    if (!PROJECT_STATUSES.includes(body.status)) return fail("Invalid project status.", 400);
    if (body.status !== project.status) {
      const allowed = STATUS_TRANSITIONS[project.status] || [];
      if (!allowed.includes(body.status)) {
        return fail(
          `Status cannot move from "${project.status}" to "${body.status}".`,
          400
        );
      }
    }
    update.status = body.status;
  }

  if (body.rera) {
    update.rera = {
      state: sanitizeText(body.rera?.state, 80),
      registrationNumber: sanitizeText(body.rera?.registrationNumber, 40).toUpperCase(),
      promoterName: sanitizeText(body.rera?.promoterName, 160),
      projectName: sanitizeText(body.rera?.projectName, 160),
      registrationDate: body.rera?.registrationDate ? new Date(body.rera.registrationDate) : null,
      completionDate: body.rera?.completionDate ? new Date(body.rera.completionDate) : null,
      // never auto-verify
      status: "pending",
    };
  }

  Object.assign(project, update);
  await project.save();

  if (update.status) {
    await createNotification({
      userId: project.landownerId || project.landId,
      type: "project_update",
      title: "Project status updated",
      message: `"${project.name}" is now "${project.status}".`,
      entityType: "project",
      entityId: project._id,
      link: "/landowner/projects",
    });
    audit({ actor: user._id, entity: "project", entityId: project._id, action: "project_status_updated", metadata: { status: project.status } });
  }

  return ok({ project, message: "Project updated." });
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);

  await connectDB();
  const project = await Project.findById(id);
  if (!project) return fail("Project not found.", 404);
  if (String(project.builderId) !== String(user._id)) {
    return fail("You are not authorized to delete this project.", 403);
  }

  await ProjectDocument.deleteMany({ projectId: id });
  await MaterialRequirement.deleteMany({ projectId: id });
  await Project.deleteOne({ _id: id });

  audit({ actor: user._id, entity: "project", entityId: id, action: "project_deleted" });

  return ok({ message: "Project deleted." });
});
