import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import LandListing from "@/lib/models/LandListing";
import Interest from "@/lib/models/Interest";
import User from "@/lib/models/User";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";

/**
 * POST: Express interest in a land listing (as a buyer or builder).
 * GET: List interests for the current owner's listings OR a user's own expressions.
 */
export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();

  const landId = body.landId;
  if (!mongoose.isValidObjectId(landId)) {
    return fail("Invalid land listing.", 400);
  }

  const type = body.type === "builder" ? "builder" : "buyer";
  const message = sanitizeText(body.message, 1000);

  const purpose =
    type === "builder"
      ? ["Development", "Acquisition", "Joint Development", "Other"].includes(body.purpose)
        ? body.purpose
        : "Other"
      : "";
  const budget =
    type === "builder" ? Math.max(0, Number(body.budget) || 0) : null;
  const timeline = type === "builder" ? sanitizeText(body.timeline, 200) : "";

  if (type === "builder" && !message.trim()) {
    return fail("Please provide a brief message about your interest.", 400);
  }

  await connectDB();

  const listing = await LandListing.findById(landId);
  if (!listing) return fail("Listing not found.", 404);
  if (String(listing.ownerId) === String(user._id)) {
    return fail("You cannot express interest in your own listing.", 400);
  }

  const existing = await Interest.findOne({
    landId,
    interestedUserRef: user._id,
    status: { $ne: "withdrawn" },
  });
  if (existing) {
    return fail("You have already expressed interest in this listing.", 409);
  }

  const interest = await Interest.create({
    landId,
    interestedUserRef: user._id,
    ownerId: listing.ownerId,
    type,
    message,
    purpose,
    budget,
    timeline,
    status: "pending",
  });

  await LandListing.findByIdAndUpdate(landId, { $inc: { interestedUsers: 1 } });

  await createNotification({
    userId: listing.ownerId,
    type: "new_interest",
    title: type === "builder" ? "New builder interest" : "New buyer interest",
    message: `${user.name} is interested in "${listing.title}".`,
    entityType: "interest",
    entityId: interest._id,
    link: `/landowner/interests?type=${type}`,
    metadata: { interestId: interest._id, landId, type },
  });

  audit({
    actor: user._id,
    entity: "interest",
    entityId: interest._id,
    action: "interest_created",
    metadata: { type, landId, ownerId: listing.ownerId },
  });

  return ok({ interest, message: "Your interest has been recorded." }, 201);
});

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope") || "owner";
  await connectDB();

  if (scope === "owner") {
    // Landowners: interest in their listings
    await LandListing.find({});
    const interests = await Interest.find({ ownerId: user._id })
      .sort({ createdAt: -1 })
      .populate("interestedUserRef", "name username avatar roles")
      .populate("landId", "title area.location location pricing")
      .lean();
    return ok({ interests });
  }

  // scope === "mine": interest the user has expressed
  const interests = await Interest.find({ interestedUserRef: user._id })
    .sort({ createdAt: -1 })
    .populate("landId", "title location pricing status verificationStatus ownerId")
    .lean();
  return ok({ interests });
});
