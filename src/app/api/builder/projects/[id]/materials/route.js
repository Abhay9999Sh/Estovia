import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import MaterialRequirement from "@/lib/models/MaterialRequirement";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);

  await connectDB();
  const project = await Project.findById(id);
  if (!project) return fail("Project not found.", 404);
  if (String(project.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  const materials = await MaterialRequirement.find({ projectId: id })
    .sort({ createdAt: -1 })
    .lean();
  return ok({ materials });
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);

  const body = await request.json();
  const material = sanitizeText(body.material, 160);
  if (!material) return fail("Please provide the material or service.", 400);

  await connectDB();
  const project = await Project.findById(id);
  if (!project) return fail("Project not found.", 404);
  if (String(project.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  const req = await MaterialRequirement.create({
    projectId: id,
    builderId: user._id,
    material,
    category: sanitizeText(body.category, 80),
    quantity: Math.max(0, Number(body.quantity) || 0),
    unit: sanitizeText(body.unit, 40),
    requiredBy: body.requiredBy ? new Date(body.requiredBy) : null,
    description: sanitizeText(body.description, 1000),
    status: "Open",
  });

  return ok({ material: req, message: "Requirement added." }, 201);
});
