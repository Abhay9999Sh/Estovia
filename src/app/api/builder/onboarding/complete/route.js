import { requireAuth, hasRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import BuilderProfile from "@/lib/models/BuilderProfile";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const profile = await BuilderProfile.findOne({ userId: user._id });

  if (!profile) {
    return fail("Please complete your builder profile first.", 400);
  }

  if (!profile.fullName || !profile.phone || !profile.companyName) {
    return fail("Please complete your personal and company details first.", 400);
  }

  profile.onboardingComplete = true;
  await profile.save();

  const roleUpdates = { profileCompleted: true };
  if (!hasRole(user, "builder")) {
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { roles: "builder" },
      profileCompleted: true,
    });
  } else {
    await User.findByIdAndUpdate(user._id, { profileCompleted: true });
  }

  return ok({ message: "Builder profile completed successfully." });
});
