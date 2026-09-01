import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerProfile from "@/lib/models/BuyerProfile";
import BuyerApplication from "@/lib/models/BuyerApplication";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import { ok, fail, sanitizeText, validateRequired } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { findOrCreateConversation } from "@/lib/dialog";
import { isValidIndianPhone, PHONE_ERROR } from "@/lib/phone";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const applications = await BuyerApplication.find({ buyerId: user._id })
    .sort({ createdAt: -1 })
    .populate("projectId", "name location")
    .populate("unitId", "unitNumber unitType tower floor")
    .lean();
  return ok({ applications });
});

// Create an application / booking request for a unit. Server-side double
// booking guard: the unit must currently be "Available" to reserve.
export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();

  const missing = validateRequired(body, ["projectId", "unitId"]);
  if (missing) return fail(`${missing} is required.`);
  if (!mongoose.isValidObjectId(body.projectId) || !mongoose.isValidObjectId(body.unitId)) {
    return fail("Invalid project or unit.", 400);
  }

  const project = await Project.findById(body.projectId);
  if (!project) return fail("Project not found.", 404);

  const buyerPhone = sanitizeText(body.buyerDetails?.phone, 20).replace(/[\s\-()]/g, "").trim();
  if (buyerPhone && !isValidIndianPhone(buyerPhone)) {
    return fail(PHONE_ERROR, 400);
  }

  const buyerProfile = await BuyerProfile.findOne({ userId: user._id }).lean();

  // Atomic claim to prevent double booking.
  const unit = await ProjectUnit.findOneAndUpdate(
    { _id: body.unitId, projectId: project._id, status: "Available", isActive: true },
    { $set: { status: "Reserved", bookedByBuyerId: user._id } },
    { new: true }
  );
  if (!unit) {
    return fail("This unit is no longer available. Please select another unit.", 409);
  }

  const applicationNumber = "APP-" + Date.now().toString(36).toUpperCase();

  const application = await BuyerApplication.create({
    applicationNumber,
    buyerId: user._id,
    buyerProfileId: buyerProfile?._id || null,
    builderId: project.builderId,
    projectId: project._id,
    unitId: unit._id,
    inquiryId: body.inquiryId || null,
    unitDetails: {
      unitNumber: unit.unitNumber,
      tower: unit.tower,
      floor: unit.floor,
      unitType: unit.unitType,
      sizeSqFt: unit.sizeSqFt,
      price: unit.price,
    },
    buyerDetails: {
      name: sanitizeText(body.buyerDetails?.name, 120) || buyerProfile?.fullName || user.name || "",
      pan: sanitizeText(body.buyerDetails?.pan, 20).toUpperCase(),
      email: sanitizeText(body.buyerDetails?.email, 120),
      phone: buyerPhone,
      address: sanitizeText(body.buyerDetails?.address, 500),
      coApplicants: Array.isArray(body.buyerDetails?.coApplicants)
        ? body.buyerDetails.coApplicants.map((s) => sanitizeText(s, 120)).filter(Boolean)
        : [],
    },
    financing: {
      required: !!body.financing?.required,
      mode: sanitizeText(body.financing?.mode, 80),
      loanAmount: Math.max(0, Number(body.financing?.loanAmount) || 0),
    },
    status: "Initiated",
    payment: { amount: unit.price || 0, paid: false, status: "Pending", method: "", reference: "" },
    builderApproval: { status: "Pending", note: "" },
    steps: [
      { step: "Initiated", status: "Completed" },
      { step: "Personal Details", status: "In Progress" },
      { step: "Document Upload", status: "Pending" },
      { step: "Verification/Review", status: "Pending" },
      { step: "Offer Stage", status: "Pending" },
      { step: "Financing", status: "Pending" },
      { step: "Payment", status: "Pending" },
      { step: "Awaiting Allotment", status: "Pending" },
      { step: "Registered", status: "Pending" },
    ],
  });

  unit.applicationId = application._id;
  await unit.save();

  await findOrCreateConversation({
    context: "builder_buyer",
    participantIds: [user._id, project.builderId],
    extra: {
      buyerId: user._id,
      builderId: project.builderId,
      projectId: project._id,
      unitId: unit._id,
      applicationId: application._id,
    },
  });

  await createNotification({
    userId: project.builderId,
    type: "application_submitted",
    title: "New application submitted",
    message: `${application.buyerDetails.name} applied for ${unit.unitNumber || "a unit"} in "${project.name}".`,
    entityType: "application",
    entityId: application._id,
    link: "/builder/buyer-leads",
    metadata: { applicationId: application._id, unitId: unit._id },
  });

  return ok({ application, message: "Application submitted. Unit reserved." }, 201);
});
