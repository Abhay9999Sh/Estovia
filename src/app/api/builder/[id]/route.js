import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import BuilderProfile from "@/lib/models/BuilderProfile";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

/**
 * GET /api/builder/[id]
 * Public builder profile for viewing by landowners/others. Only exposes
 * public information. Private KYC / documents are never returned.
 */
export const GET = withErrorHandling(async (request, ctx) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Builder not found.", 404);

  await connectDB();

  const profile = await BuilderProfile.findOne({ userId: id }).lean();
  if (!profile) return fail("Builder not found.", 404);

  const user = await User.findById(id).select("name username avatar phone roles").lean();

  return ok({
    builder: {
      _id: id,
      userId: id,
      username: user?.username || "",
      name: user?.name || profile.fullName || "",
      avatar: profile.avatar || user?.avatar || "",
      companyName: profile.companyName || "",
      businessType: profile.businessType || "",
      designation: profile.designation || "",
      verified: user?.roles?.includes?.("builder") || false,

      yearsOfExperience: profile.yearsOfExperience || 0,
      completedProjects: profile.completedProjects || 0,
      ongoingProjects: profile.ongoingProjects || 0,
      specializations: profile.specializations || [],
      developmentAreas: profile.developmentAreas || [],
      propertyTypes: profile.propertyTypes || [],
      operatingLocations: profile.operatingLocations || [],
      logo: profile.logo || "",
      bio: profile.bio || "",

      panVerified: profile.verification?.pan === "verified",
      gstVerified: profile.verification?.gst === "verified",
      businessVerified: profile.verification?.business === "verified",
      reraVerified: (profile.reraRegistrations || []).some(
        (r) => r.status === "verified"
      ),
      memberSince: profile.createdAt || null,
    },
  });
});
