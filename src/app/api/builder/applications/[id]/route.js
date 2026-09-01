import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerApplication from "@/lib/models/BuyerApplication";
import ProjectUnit from "@/lib/models/ProjectUnit";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const GET = withErrorHandling(async (request, ctx) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Application not found.", 400);
  await connectDB();
  const application = await BuyerApplication.findOne({ _id: id })
    .populate("buyerId", "name avatar phone email")
    .populate("projectId", "name")
    .populate("unitId", "unitNumber unitType tower floor price sizeSqFt")
    .lean();
  if (!application) return fail("Application not found.", 404);
  return ok({ application });
});

// POST { action, ... }
export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Application not found.", 400);
  const body = await request.json();
  const action = body.action;
  await connectDB();
  const application = await BuyerApplication.findOne({ _id: id, builderId: user._id });
  if (!application) return fail("Application not found.", 404);

  if (action === "approve") {
    if (application.status === "Cancelled" || application.status === "Rejected") {
      return fail("This application is closed.", 400);
    }
    // Approve: reserve -> booked (payment still "Manual Review").
    application.builderApproval = { status: "Approved", note: sanitizeText(body.note, 500) };
    application.status = "Offer Stage";
    await ProjectUnit.updateOne(
      { _id: application.unitId },
      { $set: { status: "Booked" } }
    );
    await application.save();
    await createNotification({
      userId: application.buyerId,
      type: "application_approved",
      title: "Application approved",
      message: `Your application for unit ${application.unitDetails.unitNumber || ""} was approved by the builder.`,
      entityType: "application",
      entityId: application._id,
      link: "/buyer/applications",
      metadata: { applicationId: application._id },
    });
    return ok({ application: application.toObject(), message: "Application approved." });
  }

  if (action === "verifyDocument") {
    const index = Number(body.index);
    if (!application.documents[index]) return fail("Document not found.", 400);
    application.documents[index].status = "Verified";
    await application.save();
    return ok({ application: application.toObject(), message: "Document verified." });
  }

  if (action === "reject") {
    application.builderApproval = { status: "Rejected", note: sanitizeText(body.note, 500) };
    application.rejectionReason = sanitizeText(body.reason, 500);
    application.status = "Rejected";
    // Release unit.
    await ProjectUnit.updateOne(
      { _id: application.unitId, bookedByBuyerId: application.buyerId },
      { $set: { status: "Available", bookedByBuyerId: null, applicationId: null } }
    );
    await application.save();
    await createNotification({
      userId: application.buyerId,
      type: "application_rejected",
      title: "Application update",
      message: "Your application was not approved. The unit has been released.",
      entityType: "application",
      entityId: application._id,
      link: "/buyer/applications",
      metadata: { applicationId: application._id },
    });
    return ok({ application: application.toObject(), message: "Application rejected." });
  }

  if (action === "markSold" || action === "register") {
    if (application.status === "Rejected" || application.status === "Cancelled") {
      return fail("This application is closed.", 400);
    }
    application.status = action === "markSold" ? "Allotted" : "Registered";
    application.payment.status = "Manual Review";
    await ProjectUnit.updateOne(
      { _id: application.unitId },
      { $set: { status: action === "markSold" ? "Sold" : "Registered", soldAt: new Date() } }
    );
    await application.save();
    return ok({ application: application.toObject(), message: "Application updated." });
  }

  return fail("Invalid action.", 400);
});
