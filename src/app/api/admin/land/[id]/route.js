import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import mongoose from "mongoose";
import LandListing from "@/lib/models/LandListing";
import User from "@/lib/models/User";

export const GET = withErrorHandling(async (request, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Invalid listing.", 400);
  await connectDB();

  const listing = await LandListing.findById(id).lean();
  if (!listing) return fail("Listing not found.", 404);
  const owner = await User.findById(listing.ownerId).select("name username email roles verification").lean();
  const [documents, interests] = await Promise.all([
    import("@/lib/models/LandDocument").then(({ default: M }) => M.find({ landId: id }).sort({ createdAt: -1 }).lean()),
    import("@/lib/models/Interest").then(({ default: M }) => M.find({ landId: id }).sort({ createdAt: -1 }).limit(20).lean()),
  ]);

  return ok({ listing, owner, documents, interests });
});

export const PATCH = withErrorHandling(async (request, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Invalid listing.", 400);

  const body = await request.json();
  const action = sanitizeText(body.action, 40);
  const note = sanitizeText(body.note, 1000);

  await connectDB();

  const listing = await LandListing.findById(id);
  if (!listing) return fail("Listing not found.", 404);

  const prevVerification = listing.verificationStatus;
  const prevStatus = listing.status;

  const valid = ["approve", "reject", "pause", "activate", "under_review"];
  if (!valid.includes(action)) return fail("Invalid action.", 400);
  if (action === "reject" && !note) return fail("A reason is required when rejecting.", 400);

  if (action === "approve") {
    listing.verificationStatus = "verified";
    listing.status = "active";
  } else if (action === "reject") {
    listing.verificationStatus = "rejected";
    listing.status = "rejected";
  } else if (action === "pause") {
    listing.status = "paused";
  } else if (action === "activate") {
    if (listing.verificationStatus !== "verified") listing.verificationStatus = "verified";
    listing.status = "active";
  } else if (action === "under_review") {
    listing.verificationStatus = "under_review";
  }

  listing.reviewNotes = note || listing.reviewNotes || "";
  listing.reviewedBy = admin._id;
  listing.reviewedAt = new Date();
  await listing.save();

  audit({
    actor: admin._id,
    actorRole: "admin",
    entity: "land_listing",
    entityId: String(listing._id),
    action: `land_${action}`,
    previousStatus: prevVerification || prevStatus,
    newStatus: listing.verificationStatus || listing.status,
    reason: note,
  });

  await createNotification({
    userId: String(listing.ownerId),
    type: "moderation",
    title:
      action === "approve" ? "Listing approved"
      : action === "reject" ? "Listing rejected"
      : action === "pause" ? "Listing paused"
      : action === "activate" ? "Listing activated"
      : "Listing under review",
    message: action === "reject" ? `Your listing was rejected. ${note ? "Reason: " + note : ""}` : `Your listing "${listing.title}" was ${action} by an admin.`,
    link: `/land/${listing._id}`,
    metadata: { note, action },
  });

  return ok({ listing, message: `Listing ${action}d successfully.` });
});