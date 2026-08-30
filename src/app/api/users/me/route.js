import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import LandownerProfile from "@/lib/models/LandownerProfile";
import LandListing from "@/lib/models/LandListing";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();

  await connectDB();
  const landowner = await LandownerProfile.findOne({ userId: user._id }).lean();

  const listingCount = await LandListing.countDocuments({ ownerId: user._id });

  return ok({
    user,
    landowner: landowner || null,
    hasLandownerProfile: !!landowner,
    listingCount,
  });
});
