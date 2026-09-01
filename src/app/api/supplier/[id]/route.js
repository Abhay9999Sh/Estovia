import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import SupplierProduct from "@/lib/models/SupplierProduct";
import SupplierService from "@/lib/models/SupplierService";
import SupplierRating from "@/lib/models/SupplierRating";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request, ctx) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Supplier not found.", 400);

  await connectDB();
  const profile = await SupplierProfile.findById(id).lean();
  if (!profile) return fail("Supplier not found.", 404);

  const products = await SupplierProduct.find({ supplierId: id, isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  const services = await SupplierService.find({ supplierId: id, isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  const recentRatings = await SupplierRating.find({ supplierProfileId: id })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("ratedBy", "name avatar")
    .lean();

  const publicProfile = {
    _id: profile._id,
    businessName: profile.businessName,
    category: profile.category,
    subcategories: profile.subcategories,
    logo: profile.logo,
    coverImage: profile.coverImage,
    bio: profile.bio,
    businessAddress: profile.officeAddress || profile.registeredAddress,
    verified: profile.verification.business === "verified",
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    orderCount: profile.orderCount,
    yearsOfExperience: profile.yearsOfExperience,
    serviceableStates: profile.serviceableStates,
    productCategories: profile.productCategories,
    serviceCategories: profile.serviceCategories,
    operatingLocations: profile.operatingLocations,
    onboardingComplete: profile.onboardingComplete,
  };

  return ok({
    profile: publicProfile,
    products,
    services,
    ratings: recentRatings,
  });
});
