import { requireAuth, hasRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import BuyerProfile from "@/lib/models/BuyerProfile";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const profile = await BuyerProfile.findOne({ userId: user._id });

  if (!profile) {
    return fail("Please complete your buyer profile first.", 400);
  }

  if (!profile.fullName || !profile.phone) {
    return fail("Please complete your personal details first.", 400);
  }

  profile.onboardingComplete = true;
  await profile.save();

  await User.findByIdAndUpdate(user._id, {
    $addToSet: { roles: "buyer" },
    profileCompleted: true,
  });

  return ok({ message: "Buyer profile completed successfully." });
});
