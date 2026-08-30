import { requireAuth, hasRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import LandownerProfile from "@/lib/models/LandownerProfile";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const profile = await LandownerProfile.findOne({ userId: user._id });

  if (!profile) {
    return fail("Please complete your landowner profile first.", 400);
  }

  if (!profile.fullName || !profile.phone) {
    return fail("Please complete your personal details first.", 400);
  }

  profile.onboardingComplete = true;
  await profile.save();

  const roleUpdates = { profileCompleted: true };
  if (!hasRole(user, "landowner")) {
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { roles: "landowner" },
      profileCompleted: true,
    });
  } else {
    await User.findByIdAndUpdate(user._id, { profileCompleted: true });
  }

  return ok({ message: "Landowner profile completed successfully." });
});
