import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerInquiry from "@/lib/models/BuyerInquiry";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const GET = withErrorHandling(async (request, ctx) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Inquiry not found.", 400);
  await connectDB();
  const inquiry = await BuyerInquiry.findOne({ _id: id })
    .populate("buyerId", "name avatar phone")
    .populate("projectId", "name")
    .populate("unitId", "unitNumber unitType")
    .lean();
  if (!inquiry) return fail("Inquiry not found.", 404);
  return ok({ inquiry });
});

// POST { action, note } - builder handles a buyer inquiry
export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Inquiry not found.", 400);
  const body = await request.json();
  const action = body.action;
  await connectDB();
  const inquiry = await BuyerInquiry.findOne({ _id: id, builderId: user._id });
  if (!inquiry) return fail("Inquiry not found.", 404);

  if (action === "respond") {
    inquiry.status = "Responded";
    await inquiry.save();
    await createNotification({
      userId: inquiry.buyerId,
      type: "inquiry_responded",
      title: "Your inquiry was responded to",
      message: `The builder responded to your inquiry${inquiry.projectId ? "" : ""}.`,
      entityType: "inquiry",
      entityId: inquiry._id,
      link: "/buyer/inquiries",
      metadata: { inquiryId: inquiry._id },
    });
    return ok({ inquiry: inquiry.toObject(), message: "Inquiry marked as responded." });
  }

  if (action === "close") {
    inquiry.status = "Closed";
    await inquiry.save();
    return ok({ inquiry: inquiry.toObject(), message: "Inquiry closed." });
  }

  if (action === "convert") {
    inquiry.status = "Converted";
    await inquiry.save();
    return ok({ inquiry: inquiry.toObject(), message: "Inquiry marked as converted." });
  }

  return fail("Invalid action.", 400);
});
