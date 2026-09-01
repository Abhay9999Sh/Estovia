import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SiteVisit from "@/lib/models/SiteVisit";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Site visit not found.", 400);
  await connectDB();
  const visit = await SiteVisit.findOne({
    _id: id,
    $or: [{ builderId: user._id }, { buyerId: user._id }],
  })
    .populate("buyerId", "name avatar phone")
    .populate("projectId", "name")
    .populate("unitId", "unitNumber unitType")
    .lean();
  if (!visit) return fail("Site visit not found.", 404);
  return ok({ visit });
});

// POST { action } - builder schedules/confirms/completes/cancels a visit
export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Site visit not found.", 400);
  const body = await request.json();
  const action = body.action;
  await connectDB();
  const visit = await SiteVisit.findOne({ _id: id, builderId: user._id });
  if (!visit) return fail("Site visit not found.", 404);

  if (action === "schedule") {
    if (body.scheduledDate) visit.scheduledDate = new Date(body.scheduledDate);
    if (body.scheduledTimeSlot) visit.scheduledTimeSlot = sanitizeText(body.scheduledTimeSlot, 80);
    visit.builderNotes = sanitizeText(body.notes, 1000);
    visit.status = "Confirmed";
    await visit.save();
    await createNotification({
      userId: visit.buyerId,
      type: "site_visit_confirmed",
      title: "Site visit confirmed",
      message: "Your site visit request has been confirmed.",
      entityType: "siteVisit",
      entityId: visit._id,
      link: "/buyer/site-visits",
      metadata: { siteVisitId: visit._id },
    });
    return ok({ visit: visit.toObject(), message: "Site visit scheduled." });
  }

  if (action === "complete") {
    visit.status = "Completed";
    visit.checkedOutAt = new Date();
    await visit.save();
    return ok({ visit: visit.toObject(), message: "Site visit marked completed." });
  }

  if (action === "noshow") {
    visit.status = "No Show";
    await visit.save();
    return ok({ visit: visit.toObject(), message: "Site visit marked as no-show." });
  }

  if (action === "cancel") {
    visit.status = "Cancelled";
    await visit.save();
    return ok({ visit: visit.toObject(), message: "Site visit cancelled." });
  }

  return fail("Invalid action.", 400);
});
