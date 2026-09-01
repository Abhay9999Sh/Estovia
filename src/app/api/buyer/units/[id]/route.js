import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import BuyerSaved from "@/lib/models/BuyerSaved";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Unit not found.", 400);
  await connectDB();
  const unit = await ProjectUnit.findOne({ _id: id, isActive: true }).lean();
  if (!unit) return fail("Unit not found.", 404);

  const project = await Project.findById(unit.projectId).lean();

  const saved = !!(await BuyerSaved.findOne({
    buyerId: user._id,
    entityType: "unit",
    entityId: unit._id,
  }));

  return ok({ unit, project, saved });
});
