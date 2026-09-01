import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerProfile from "@/lib/models/BuyerProfile";
import BuyerInquiry from "@/lib/models/BuyerInquiry";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import { ok, fail, sanitizeText, validateRequired } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { findOrCreateConversation } from "@/lib/dialog";

const TYPES = ["Project Inquiry", "Unit Inquiry", "General", "Finance", "Site Visit", "Other"];

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const inquiries = await BuyerInquiry.find({ buyerId: user._id })
    .sort({ createdAt: -1 })
    .populate("projectId", "name")
    .populate("unitId", "unitNumber unitType")
    .populate("builderId", "name")
    .lean();
  return ok({ inquiries });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();

  const missing = validateRequired(body, ["builderId"]);
  if (missing) return fail(`${missing} is required.`);
  if (!mongoose.isValidObjectId(body.builderId)) return fail("Invalid builder.", 400);

  const buyerProfile = await BuyerProfile.findOne({ userId: user._id }).lean();

  let project = null;
  if (body.projectId) {
    if (!mongoose.isValidObjectId(body.projectId)) return fail("Invalid project.", 400);
    project = await Project.findById(body.projectId);
    if (!project) return fail("Project not found.", 404);
    if (String(project.builderId) !== String(body.builderId)) {
      return fail("Project does not belong to that builder.", 400);
    }
  }

  let unit = null;
  if (body.unitId) {
    if (!mongoose.isValidObjectId(body.unitId)) return fail("Invalid unit.", 400);
    unit = await ProjectUnit.findById(body.unitId);
    if (!unit) return fail("Unit not found.", 404);
    if (project && String(unit.projectId) !== String(project._id)) {
      return fail("Unit does not belong to that project.", 400);
    }
  }

  const inquiry = await BuyerInquiry.create({
    buyerId: user._id,
    buyerProfileId: buyerProfile?._id || null,
    builderId: body.builderId,
    projectId: project?._id || null,
    unitId: unit?._id || null,
    type: TYPES.includes(body.type) ? body.type : "Project Inquiry",
    message: sanitizeText(body.message, 2000),
    contact: {
      name: sanitizeText(body.contact?.name, 120) || user.name || "",
      phone: sanitizeText(body.contact?.phone, 20),
      email: sanitizeText(body.contact?.email, 120),
    },
    status: "New",
  });

  // Open a conversation channel between buyer and builder.
  await findOrCreateConversation({
    context: "builder_buyer",
    participantIds: [user._id, body.builderId],
    extra: {
      buyerId: user._id,
      builderId: body.builderId,
      projectId: project?._id || null,
      unitId: unit?._id || null,
      inquiryId: inquiry._id,
    },
  });

  await createNotification({
    userId: body.builderId,
    type: "buyer_inquiry",
    title: "New buyer inquiry",
    message: `${inquiry.contact.name || "A buyer"} sent you an inquiry${project ? ` about "${project.name}"` : ""}.`,
    entityType: "inquiry",
    entityId: inquiry._id,
    link: "/builder/buyer-leads",
    metadata: { inquiryId: inquiry._id, projectId: project?._id },
  });

  return ok({ inquiry, message: "Inquiry sent." }, 201);
});
