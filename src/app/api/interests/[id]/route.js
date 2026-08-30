import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Interest from "@/lib/models/Interest";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const PATCH = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;

  if (!mongoose.isValidObjectId(id)) {
    return fail("Invalid interest.", 400);
  }

  const body = await request.json();
  const action = body.action; // "accept" | "reject"

  await connectDB();

  const interest = await Interest.findById(id);
  if (!interest) return fail("Interest not found.", 404);

  // Only the owner of the listing can respond
  if (String(interest.ownerId) !== String(user._id)) {
    return fail("You are not authorized to perform this action.", 403);
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

  return ok({ interest, message: "Interest updated successfully." });
});
