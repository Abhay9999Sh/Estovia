import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SiteVisit from "@/lib/models/SiteVisit";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const GET = withErrorHandling(async (request, ctx) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Site visit not found.", 400);
  await connectDB();
  const visit = await SiteVisit.findById(id)
    .populate("projectId", "name location")
    .populate("unitId", "unitNumber unitType")
    .lean();
  if (!visit) return fail("Site visit not found.", 404);
  return ok({ visit });
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Site visit not found.", 400);
  const body = await request.json();
  const action = body.action;
  await connectDB();
  const visit = await SiteVisit.findOne({ _id: id, buyerId: user._id });
  if (!visit) return fail("Site visit not found.", 404);

  if (action === "cancel") {
    if (["Completed", "Cancelled", "No Show"].includes(visit.status)) {
      return fail("This site visit cannot be cancelled.", 400);
    }
    visit.status = "Cancelled";
    await visit.save();
    if (visit.builderId) {
      await createNotification({
        userId: visit.builderId,
        type: "site_visit_cancelled",
        title: "Site visit cancelled",
        message: "A buyer cancelled a scheduled site visit.",
        entityType: "siteVisit",
        entityId: visit._id,
        link: "/builder/buyer-leads",
        metadata: { siteVisitId: visit._id },
      });
    }
    return ok({ visit: visit.toObject(), message: "Site visit cancelled." });
  }

  if (action === "confirm") {
    if (!user.roles?.includes("builder") && !user.roles?.includes("admin")) {
      return fail("Only builders can confirm site visits.", 403);
    }
    if (String(visit.builderId) !== String(user._id)) {
      return fail("You can only confirm your own site visits.", 403);
    }
    visit.status = "Confirmed";
    if (body.scheduledDate) visit.scheduledDate = new Date(body.scheduledDate);
    if (body.scheduledTimeSlot) visit.scheduledTimeSlot = sanitizeText(body.scheduledTimeSlot, 80);
    await visit.save();
    if (visit.buyerId) {
      await createNotification({
        userId: visit.buyerId,
        type: "site_visit_confirmed",
        title: "Site visit confirmed",
        message: "Your site visit has been confirmed by the builder.",
        entityType: "siteVisit",
        entityId: visit._id,
        link: "/buyer/site-visits",
        metadata: { siteVisitId: visit._id },
      });
    }
    return ok({ visit: visit.toObject(), message: "Site visit confirmed." });
  }

  return fail("Invalid action.", 400);
});
