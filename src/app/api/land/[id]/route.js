import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import LandListing from "@/lib/models/LandListing";
import User from "@/lib/models/User";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const GET = withErrorHandling(async (request, ctx) => {
  const { id } = await ctx.params;

  if (!mongoose.isValidObjectId(id)) {
    return fail("Listing not found.", 404);
  }

  await connectDB();

  // Allow the listing owner (or an admin) to view their own listing even
  // when it is not publicly active (e.g. draft, paused, under review).
  const currentUser = await getCurrentUser();
  const isOwnerOrAdmin =
    !!currentUser &&
    (currentUser.roles?.includes("admin") ||
      String(currentUser._id) === String(
        (await LandListing.findById(id, { ownerId: 1 }).lean())?.ownerId || ""
      ));

  const listing = await LandListing.findOne({
    _id: id,
    ...(isOwnerOrAdmin ? {} : { status: "active" }),
  })
    .select("-boundary")
    .lean();

  if (!listing) return fail("Listing not found.", 404);

  const owner = await User.findById(listing.ownerId).select("name avatar username").lean();

  return ok({
    listing: {
      ...listing,
      owner: owner
        ? { name: owner.name, avatar: owner.avatar, username: owner.username }
        : null,
    },
  });
});
