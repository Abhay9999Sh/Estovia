import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SiteVisit from "@/lib/models/SiteVisit";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import BuyerProfile from "@/lib/models/BuyerProfile";
import { ok, fail, sanitizeText, validateRequired } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { findOrCreateConversation } from "@/lib/dialog";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const visits = await SiteVisit.find({ buyerId: user._id })
    .sort({ createdAt: -1 })
    .populate("projectId", "name location")
    .populate("unitId", "unitNumber unitType")
    .populate("builderId", "name")
    .lean();
  return ok({ visits });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();

  const missing = validateRequired(body, ["projectId", "requestedDate"]);
  if (missing) return fail(`${missing} is required.`);
  if (!mongoose.isValidObjectId(body.projectId)) return fail("Invalid project.", 400);

  const project = await Project.findById(body.projectId);
  if (!project) return fail("Project not found.", 404);

  let unit = null;
  if (body.unitId) {
    if (!mongoose.isValidObjectId(body.unitId)) return fail("Invalid unit.", 400);
    unit = await ProjectUnit.findById(body.unitId);
    if (!unit || String(unit.projectId) !== String(project._id)) {
      return fail("Unit not found in this project.", 400);
    }
  }

  const visit = await SiteVisit.create({
    buyerId: user._id,
    builderId: project.builderId,
    projectId: project._id,
    unitId: unit?._id || null,
    requestedDate: new Date(body.requestedDate),
    requestedTimeSlot: sanitizeText(body.requestedTimeSlot, 80),
    notes: sanitizeText(body.notes, 1000),
    status: "Requested",
    createdBy: "buyer",
  });

  await findOrCreateConversation({
    context: "builder_buyer",
    participantIds: [user._id, project.builderId],
    extra: {
      buyerId: user._id,
      builderId: project.builderId,
      projectId: project._id,
      unitId: unit?._id || null,
      siteVisitId: visit._id,
    },
  });

  await createNotification({
    userId: project.builderId,
    type: "site_visit_request",
    title: "Site visit requested",
    message: `A buyer requested a site visit for "${project.name}".`,
    entityType: "siteVisit",
    entityId: visit._id,
    link: "/builder/buyer-leads",
    metadata: { siteVisitId: visit._id },
  });

  return ok({ visit, message: "Site visit requested." }, 201);
});
