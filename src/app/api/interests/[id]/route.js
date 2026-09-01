import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Interest from "@/lib/models/Interest";
import LandListing from "@/lib/models/LandListing";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";

export const PATCH = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;

  if (!mongoose.isValidObjectId(id)) {
    return fail("Invalid interest.", 400);
  }

  const body = await request.json();
  const action = body.action; // "accept" | "reject" | "withdraw"

  await connectDB();

  const interest = await Interest.findById(id);
  if (!interest) return fail("Interest not found.", 404);

  if (action === "withdraw") {
    if (String(interest.interestedUserRef) !== String(user._id)) {
      return fail("You are not authorized to perform this action.", 403);
    }
    if (interest.status !== "pending") {
      return fail("You can only withdraw a pending interest.", 400);
    }
    interest.status = "withdrawn";
    interest.withdrawnAt = new Date();
    await interest.save();

    const listing = await LandListing.findById(interest.landId);

    await createNotification({
      userId: interest.ownerId,
      type: "interest_withdrawn",
      title: "Interest withdrawn",
      message: `${user.name} withdrew their interest in your land.`,
      entityType: "interest",
      entityId: interest._id,
      link: `/landowner/interests?type=${interest.type}`,
      metadata: { interestId: interest._id, landId: interest.landId },
    });

    audit({
      actor: user._id,
      entity: "interest",
      entityId: interest._id,
      action: "interest_withdrawn",
      metadata: { landId: interest.landId, ownerId: interest.ownerId },
    });

    return ok({ interest, message: "Interest withdrawn." });
  }

  // accept / reject: only the owner of the listing can respond
  if (String(interest.ownerId) !== String(user._id)) {
    return fail("You are not authorized to perform this action.", 403);
  }

  if (interest.status !== "pending") {
    return fail("This interest has already been responded to.", 400);
  }

  if (action === "accept") {
    interest.status = "accepted";
  } else if (action === "reject") {
    interest.status = "rejected";
  } else {
    return fail("Invalid action.", 400);
  }

  interest.viewedByOwner = true;
  await interest.save();

  const listing = await LandListing.findById(interest.landId);
  const listingTitle = listing?.title || "your land";

  if (action === "accept") {
    await createNotification({
      userId: interest.interestedUserRef,
      type: "interest_accepted",
      title: "Interest accepted",
      message: `The landowner accepted your interest in "${listingTitle}". You can now discuss and send a proposal.`,
      entityType: "interest",
      entityId: interest._id,
      link: "/builder/interests",
      metadata: { interestId: interest._id, landId: interest.landId },
    });
  } else {
    await createNotification({
      userId: interest.interestedUserRef,
      type: "interest_rejected",
      title: "Interest declined",
      message: `The landowner declined your interest in "${listingTitle}".`,
      entityType: "interest",
      entityId: interest._id,
      link: "/builder/interests",
      metadata: { interestId: interest._id, landId: interest.landId },
    });
  }

  audit({
    actor: user._id,
    entity: "interest",
    entityId: interest._id,
    action: action === "accept" ? "interest_accepted" : "interest_rejected",
    metadata: { landId: interest.landId, interestedUserRef: interest.interestedUserRef },
  });

  return ok({ interest, message: "Interest updated successfully." });
});
