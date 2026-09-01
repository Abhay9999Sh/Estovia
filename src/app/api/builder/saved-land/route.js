import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import SavedLand from "@/lib/models/SavedLand";
import LandListing from "@/lib/models/LandListing";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { searchParams } = request.nextUrl;
  const landId = searchParams.get("landId") || "";
  await connectDB();

  // Returns boolean saved state for a single listing (for detail page button)
  if (landId) {
    if (!mongoose.isValidObjectId(landId)) return ok({ saved: false });
    const saved = await SavedLand.findOne({ userId: user._id, landId });
    return ok({ saved: !!saved });
  }

  const saved = await SavedLand.find({ userId: user._id })
    .populate("landId", "title description propertyType landUse area location pricing verificationStatus status images views interestedUsers ownerId createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const records = saved
    .filter((s) => s.landId)
    .map((s) => ({ savedId: s._id, savedAt: s.createdAt, land: s.landId }));

  return ok({ saved: records });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { landId } = await request.json();
  if (!mongoose.isValidObjectId(landId)) return fail("Invalid land listing.", 400);

  await connectDB();
  const listing = await LandListing.findById(landId);
  if (!listing) return fail("Listing not found.", 404);
  if (String(listing.ownerId) === String(user._id)) {
    return fail("You cannot save your own listing.", 400);
  }

  const existing = await SavedLand.findOne({ userId: user._id, landId });
  if (existing) return ok({ saved: true, message: "Already saved." });

  await SavedLand.create({ userId: user._id, landId });

  return ok({ saved: true, message: "Saved land." }, 201);
});
