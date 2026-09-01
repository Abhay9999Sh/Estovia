import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/lib/models/Conversation";
import LandListing from "@/lib/models/LandListing";
import Interest from "@/lib/models/Interest";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const conversations = await Conversation.find({
    $or: [
      { builderId: user._id },
      { landownerId: user._id },
      { supplierId: user._id },
      { buyerId: user._id },
    ],
  })
    .sort({ lastMessageAt: -1 })
    .populate("builderId", "name avatar username")
    .populate("landownerId", "name avatar username")
    .populate("supplierId", "name avatar username")
    .populate("buyerId", "name avatar username")
    .populate("landId", "title location pricing images")
    .lean();

  return ok({ conversations });
});

/**
 * POST: Start a conversation between builder and landowner (used when an
 * interest is accepted). Idempotent - returns existing if already present.
 */
export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { landId, landownerId, interestId, proposalId } = await request.json();

  if (!mongoose.isValidObjectId(landId) || !mongoose.isValidObjectId(landownerId)) {
    return fail("Invalid conversation participants.", 400);
  }
  if (String(landownerId) === String(user._id)) {
    return fail("You cannot message yourself.", 400);
  }

  await connectDB();

  // The interested user must have some relationship to the land (an
  // interest) to open a conversation, and cannot be the owner.
  const listing = await LandListing.findById(landId);
  if (!listing) return fail("Listing not found.", 404);

  const isOwner = String(listing.ownerId) === String(user._id);

  let interestCheck = null;
  if (isOwner) {
    // Owner messages a builder who expressed interest
    interestCheck = await Interest.findOne({
      landId,
      ownerId: user._id,
      interestedUserRef: landownerId,
    });
  } else {
    interestCheck = await Interest.findOne({
      landId,
      interestedUserRef: user._id,
      ownerId: landownerId,
    });
  }

  if (!interestCheck) {
    return fail(
      "You can only message the other party after expressing interest.",
      403
    );
  }

  const builderId = isOwner ? landownerId : user._id;
  const actualOwnerId = String(listing.ownerId);

  const existing = await Conversation.findOne({
    landId,
    builderId,
    landownerId: actualOwnerId,
  });
  if (existing) {
    return ok({ conversation: existing, message: "Conversation already exists." });
  }

  const conversation = await Conversation.create({
    landId,
    builderId,
    landownerId: actualOwnerId,
    interestId: interestCheck._id || null,
    proposalId: proposalId || null,
    lastMessageAt: null,
  });

  return ok({ conversation, message: "Conversation started." }, 201);
});
