import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import BuilderProfile from "@/lib/models/BuilderProfile";
import BuyerSaved from "@/lib/models/BuyerSaved";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);

  await connectDB();
  const project = await Project.findById(id).lean();
  if (!project) return fail("Project not found.", 404);

  const units = await ProjectUnit.find({
    projectId: id,
    isActive: true,
    status: { $in: ["Available", "On Hold", "Reserved"] },
  })
    .sort({ sizeSqFt: 1 })
    .lean();

  const builderProfile = await BuilderProfile.findOne({ userId: project.builderId })
    .select("companyName logo reraRegistrations bio")
    .lean();
  const reraVerified = builderProfile?.reraRegistrations?.some((r) => r.status === "verified");

  let saved = false;
  const savedRec = await BuyerSaved.findOne({
    buyerId: user._id,
    entityType: "project",
    entityId: project._id,
  }).lean();
  saved = !!savedRec;

  return ok({
    project: {
      ...project,
      builder: builderProfile
        ? {
            companyName: builderProfile.companyName,
            logo: builderProfile.logo,
            reraVerified,
            bio: builderProfile.bio,
          }
        : null,
    },
    units,
    saved,
  });
});
