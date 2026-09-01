import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const DESIGNATIONS = ["Owner", "Director", "Partner", "Manager", "Authorized Representative", "Other"];
const BUSINESS_TYPES = ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Sole Trader", "Other"];
const CATEGORIES = ["Materials", "Equipment", "Labour", "Services", "Fittings & Finishes", "Other"];

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id }).lean();
  return ok({ profile: profile || null });
});

export const PUT = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();

  const designation = DESIGNATIONS.includes(body.designation) ? body.designation : "";
  const businessType = BUSINESS_TYPES.includes(body.businessType) ? body.businessType : "";
  const category = CATEGORIES.includes(body.category) ? body.category : "";

  const operatingLocations = Array.isArray(body.operatingLocations)
    ? body.operatingLocations.slice(0, 30).map((l) => ({
        state: sanitizeText(l?.state, 80),
        city: sanitizeText(l?.city, 80),
        district: sanitizeText(l?.district, 80),
        area: sanitizeText(l?.area, 120),
      }))
    : [];

  const profileData = {
    ownerName: sanitizeText(body.ownerName, 120),
    fullName: sanitizeText(body.fullName, 120),
    phone: sanitizeText(body.phone, 20),
    email: sanitizeText(body.email, 120),
    designation,
    avatar: sanitizeText(body.avatar, 500),

    businessName: sanitizeText(body.businessName, 160),
    businessType,
    category,
    subcategories: Array.isArray(body.subcategories)
      ? body.subcategories.map((s) => sanitizeText(s, 120)).filter(Boolean)
      : [],
    gstin: sanitizeText(body.gstin, 30).toUpperCase(),
    pan: sanitizeText(body.pan, 20).toUpperCase(),
    udyam: sanitizeText(body.udyam, 30).toUpperCase(),
    registeredAddress: sanitizeText(body.registeredAddress, 500),
    officeAddress: sanitizeText(body.officeAddress, 500),
    website: sanitizeText(body.website, 200),
    businessEmail: sanitizeText(body.businessEmail, 120),
    businessPhone: sanitizeText(body.businessPhone, 20),
    yearEstablished: sanitizeText(body.yearEstablished, 12),

    yearsOfExperience: Math.max(0, Number(body.yearsOfExperience) || 0),
    deliveryCapability: sanitizeText(body.deliveryCapability, 500),
    serviceableStates: Array.isArray(body.serviceableStates)
      ? body.serviceableStates.map((s) => sanitizeText(s, 80)).filter(Boolean)
      : [],
    operatingLocations,
    productCategories: Array.isArray(body.productCategories)
      ? body.productCategories.map((s) => sanitizeText(s, 120)).filter(Boolean)
      : [],
    serviceCategories: Array.isArray(body.serviceCategories)
      ? body.serviceCategories.map((s) => sanitizeText(s, 120)).filter(Boolean)
      : [],
    brandsDealt: Array.isArray(body.brandsDealt)
      ? body.brandsDealt.map((s) => sanitizeText(s, 120)).filter(Boolean)
      : [],
    certifications: Array.isArray(body.certifications)
      ? body.certifications.map((s) => sanitizeText(s, 120)).filter(Boolean)
      : [],
    logo: sanitizeText(body.logo, 500),
    coverImage: sanitizeText(body.coverImage, 500),
    bio: sanitizeText(body.bio, 2000),
  };

  let profile = await SupplierProfile.findOne({ userId: user._id });

  if (!profile) {
    profile = await SupplierProfile.create({ userId: user._id, ...profileData });
  } else {
    Object.assign(profile, profileData);
    await profile.save();
  }

  if (profileData.gstin && profile.verification.gst === "pending") {
    profile.verification.gst = "submitted";
    await profile.save();
  }
  if (profileData.pan && profile.verification.pan === "pending") {
    profile.verification.pan = "submitted";
    await profile.save();
  }
  if (profileData.udyam && profile.verification.udyam === "pending") {
    profile.verification.udyam = "submitted";
    await profile.save();
  }
  if (profileData.businessName && profile.verification.business === "pending") {
    profile.verification.business = "submitted";
    await profile.save();
  }

  return ok({ profile: profile.toObject(), message: "Profile saved successfully." });
});

export async function DELETE() {
  return fail("Not supported.", 405);
}
