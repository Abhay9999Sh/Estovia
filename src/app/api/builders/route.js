import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import BuilderProfile from "@/lib/models/BuilderProfile";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

/**
 * GET /api/builders
 * Public list of verified/onboarded builders for discovery.
 * Only exposes safe public information; KYC / documents / private
 * addresses are never returned.
 *
 * Query params:
 *   - q        : search by company name or specialization
 *   - city     : filter by operating city
 *   - state    : filter by operating state
 */
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const city = (searchParams.get("city") || "").trim().toLowerCase();
  const state = (searchParams.get("state") || "").trim().toLowerCase();

  await connectDB();

  const filter = { onboardingComplete: true };

  if (q) {
    filter.$or = [
      { companyName: { $regex: q, $options: "i" } },
      { bio: { $regex: q, $options: "i" } },
      { specializations: { $regex: q, $options: "i" } },
    ];
  }
  if (city) filter["operatingLocations.city"] = { $regex: city, $options: "i" };
  if (state) filter["operatingLocations.state"] = { $regex: state, $options: "i" };

  const profiles = await BuilderProfile.find(filter)
    .select(
      "userId companyName businessType designation avatar logo bio yearsOfExperience " +
        "completedProjects ongoingProjects specializations propertyTypes developmentAreas " +
        "operatingLocations verification reraRegistrations createdAt"
    )
    .sort({ createdAt: -1 })
    .lean();

  if (!profiles.length) return ok({ builders: [] });

  const userIds = profiles.map((p) => p.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("username name avatar roles accountStatus")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const builders = profiles
    .filter((p) => {
      const u = userMap.get(String(p.userId));
      return u && u.accountStatus === "active" && Array.isArray(u.roles) && u.roles.includes("builder");
    })
    .map((p) => {
      const u = userMap.get(String(p.userId));
      return {
        _id: String(p.userId),
        userId: String(p.userId),
        username: u?.username || "",
        name: u?.name || p.fullName || p.companyName || "",
        avatar: p.avatar || u?.avatar || "",
        companyName: p.companyName || "",
        businessType: p.businessType || "",
        designation: p.designation || "",
        verified: u?.roles?.includes?.("builder") || false,
        yearsOfExperience: p.yearsOfExperience || 0,
        completedProjects: p.completedProjects || 0,
        ongoingProjects: p.ongoingProjects || 0,
        specializations: p.specializations || [],
        propertyTypes: p.propertyTypes || [],
        developmentAreas: p.developmentAreas || [],
        operatingLocations: p.operatingLocations || [],
        logo: p.logo || "",
        bio: p.bio || "",
        businessVerified: p.verification?.business === "verified",
        reraVerified: (p.reraRegistrations || []).some(
          (r) => r.status === "verified"
        ),
        memberSince: p.createdAt || null,
      };
    });

  return ok({ builders });
});
