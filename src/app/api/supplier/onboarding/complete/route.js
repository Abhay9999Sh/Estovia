import { requireAuth, hasRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import SupplierProfile from "@/lib/models/SupplierProfile";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const profile = await SupplierProfile.findOne({ userId: user._id });

  if (!profile) {
    return fail("Please complete your supplier profile first.", 400);
  }

  if (!profile.ownerName || !profile.phone || !profile.businessName) {
    return fail("Please complete your personal and business details first.", 400);
  }

  profile.onboardingComplete = true;
  await profile.save();

  await User.findByIdAndUpdate(user._id, {
    $addToSet: { roles: "supplier" },
    profileCompleted: true,
  });

  return ok({ message: "Supplier profile completed successfully." });
});
