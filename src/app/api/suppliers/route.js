import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import SupplierProfile from "@/lib/models/SupplierProfile";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

/**
 * GET /api/suppliers
 * Public list of onboarded suppliers for discovery.
 * Only exposes safe public information; KYC / documents / private
 * addresses are never returned.
 *
 * Query params:
 *   - q        : search by business name, category or description
 *   - category : filter by top-level category
 *   - city     : filter by operating city
 */
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const category = (searchParams.get("category") || "").trim();
  const city = (searchParams.get("city") || "").trim().toLowerCase();

  await connectDB();

  const filter = { onboardingComplete: true };

  if (q) {
    filter.$or = [
      { businessName: { $regex: q, $options: "i" } },
      { bio: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
      { subcategories: { $regex: q, $options: "i" } },
      { productCategories: { $regex: q, $options: "i" } },
      { serviceCategories: { $regex: q, $options: "i" } },
    ];
  }
  if (category) filter.category = category;
  if (city) filter["operatingLocations.city"] = { $regex: city, $options: "i" };

  const profiles = await SupplierProfile.find(filter)
    .select(
      "userId businessName category subcategories logo coverImage bio " +
        "yearsOfExperience serviceableStates productCategories serviceCategories " +
        "operatingLocations verification rating reviewCount orderCount isOpen createdAt"
    )
    .sort({ createdAt: -1 })
    .lean();

  if (!profiles.length) return ok({ suppliers: [] });

  const userIds = profiles.map((p) => p.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("accountStatus roles")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const suppliers = profiles
    .filter((p) => {
      const u = userMap.get(String(p.userId));
      return u && u.accountStatus === "active" && Array.isArray(u.roles) && u.roles.includes("supplier");
    })
    .map((p) => ({
      _id: String(p._id),
      userId: String(p.userId),
      businessName: p.businessName || "",
      category: p.category || "",
      subcategories: p.subcategories || [],
      logo: p.logo || "",
      coverImage: p.coverImage || "",
      bio: p.bio || "",
      businessAddress: p.officeAddress || p.registeredAddress || "",
      verified: p.verification?.business === "verified",
      rating: p.rating || 0,
      reviewCount: p.reviewCount || 0,
      orderCount: p.orderCount || 0,
      yearsOfExperience: p.yearsOfExperience || 0,
      serviceableStates: p.serviceableStates || [],
      productCategories: p.productCategories || [],
      serviceCategories: p.serviceCategories || [],
      operatingLocations: p.operatingLocations || [],
      isOpen: p.isOpen !== false,
      memberSince: p.createdAt || null,
    }));

  return ok({ suppliers });
});
