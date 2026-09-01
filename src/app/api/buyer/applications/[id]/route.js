import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerApplication from "@/lib/models/BuyerApplication";
import ProjectUnit from "@/lib/models/ProjectUnit";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Application not found.", 400);
  await connectDB();
  const application = await BuyerApplication.findById(id)
    .populate("projectId", "name location")
    .populate("unitId", "unitNumber unitType tower floor price sizeSqFt")
    .lean();
  if (!application) return fail("Application not found.", 404);
  const isBuyer = String(application.buyerId) === String(user._id);
  const isBuilder = String(application.builderId) === String(user._id);
  if (!isBuyer && !isBuilder) {
    return fail("You are not authorized to view this application.", 403);
  }
  return ok({ application });
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Application not found.", 400);
  const body = await request.json();
  const action = body.action;
  await connectDB();
  const application = await BuyerApplication.findOne({ _id: id, buyerId: user._id });
  if (!application) return fail("Application not found.", 404);

  if (action === "addDocument") {
    const name = sanitizeText(body.name, 120);
    const url = sanitizeText(body.url, 500);
    if (!name || !url) return fail("Document name and URL required.", 400);
    application.documents.push({
      name,
      url,
      status: body.status === "Verified" ? "Verified" : "Submitted",
    });
    application.status = "Document Upload";
    await application.save();
    return ok({ application: application.toObject(), message: "Document added." });
  }

  if (action === "completePersonal") {
    if (body.buyerDetails) {
      if (body.buyerDetails.name !== undefined) application.buyerDetails.name = sanitizeText(body.buyerDetails.name, 120);
      if (body.buyerDetails.pan !== undefined) application.buyerDetails.pan = sanitizeText(body.buyerDetails.pan, 20).toUpperCase();
      if (body.buyerDetails.email !== undefined) application.buyerDetails.email = sanitizeText(body.buyerDetails.email, 120);
      if (body.buyerDetails.phone !== undefined) application.buyerDetails.phone = sanitizeText(body.buyerDetails.phone, 20);
      if (body.buyerDetails.address !== undefined) application.buyerDetails.address = sanitizeText(body.buyerDetails.address, 500);
      if (Array.isArray(body.buyerDetails.coApplicants)) {
        application.buyerDetails.coApplicants = body.buyerDetails.coApplicants.map((s) => sanitizeText(s, 120)).filter(Boolean);
      }
    }
    application.status = "Personal Details";
    await application.save();
    return ok({ application: application.toObject(), message: "Details saved." });
  }

  if (action === "confirmFinancing") {
    if (body.financing) {
      application.financing.required = !!body.financing.required;
      if (body.financing.mode !== undefined) application.financing.mode = sanitizeText(body.financing.mode, 80);
      if (body.financing.loanAmount !== undefined) application.financing.loanAmount = Math.max(0, Number(body.financing.loanAmount) || 0);
    }
    application.status = "Financing";
    await application.save();
    return ok({ application: application.toObject(), message: "Financing details saved." });
  }

  if (action === "initiatePayment") {
    // Payments are architectural only - never faked as complete.
    application.payment.status = "Initiated";
    application.payment.paid = false;
    application.status = "Payment";
    await application.save();
    return ok({
      application: application.toObject(),
      message:
        "Payment initiation recorded. Actual payment confirmation requires manual verification with the builder.",
    });
  }

  if (action === "cancel") {
    application.status = "Cancelled";
    await application.save();
    // Release the unit back if it's still reserved by this buyer.
    await ProjectUnit.updateOne(
      { _id: application.unitId, bookedByBuyerId: user._id, status: "Reserved" },
      { $set: { status: "Available", bookedByBuyerId: null, applicationId: null } }
    );
    return ok({ application: application.toObject(), message: "Application cancelled." });
  }

  return fail("Invalid action.", 400);
});
