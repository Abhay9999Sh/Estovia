import { requireAuth, hasRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import BuilderProfile from "@/lib/models/BuilderProfile";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const DESIGNATIONS = ["Founder", "Director", "Partner", "Promoter", "Authorized Representative", "Other"];
const BUSINESS_TYPES = ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Individual Developer", "Other"];
const PROPERTY_TYPES = ["Residential", "Commercial", "Industrial", "Mixed Use", "Plotted Development", "Township", "Luxury Housing", "Affordable Housing", "Other"];

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const profile = await BuilderProfile.findOne({ userId: user._id }).lean();
  return ok({ profile: profile || null });
});

export const PUT = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();

  const designation = DESIGNATIONS.includes(body.designation) ? body.designation : "";
  const businessType = BUSINESS_TYPES.includes(body.businessType) ? body.businessType : "";

  const operatingLocations = Array.isArray(body.operatingLocations)
    ? body.operatingLocations.slice(0, 30).map((l) => ({
        state: sanitizeText(l?.state, 80),
        city: sanitizeText(l?.city, 80),
        district: sanitizeText(l?.district, 80),
        area: sanitizeText(l?.area, 120),
      }))
    : [];

  const profileData = {
    fullName: sanitizeText(body.fullName, 120),
    phone: sanitizeText(body.phone, 20),
    email: sanitizeText(body.email, 120),
    designation,
    avatar: sanitizeText(body.avatar, 500),

    companyName: sanitizeText(body.companyName, 160),
    businessType,
    cin: sanitizeText(body.cin, 30).toUpperCase(),
    llpin: sanitizeText(body.llpin, 30).toUpperCase(),
    pan: sanitizeText(body.pan, 20).toUpperCase(),
    gstin: sanitizeText(body.gstin, 30).toUpperCase(),
    registeredAddress: sanitizeText(body.registeredAddress, 500),
    officeAddress: sanitizeText(body.officeAddress, 500),
    website: sanitizeText(body.website, 200),
    businessEmail: sanitizeText(body.businessEmail, 120),
    businessPhone: sanitizeText(body.businessPhone, 20),
    yearEstablished: sanitizeText(body.yearEstablished, 12),

    yearsOfExperience: Math.max(0, Number(body.yearsOfExperience) || 0),
    completedProjects: Math.max(0, Number(body.completedProjects) || 0),
    ongoingProjects: Math.max(0, Number(body.ongoingProjects) || 0),
    specializations: Array.isArray(body.specializations)
      ? body.specializations.map((s) => sanitizeText(s, 120)).filter(Boolean)
      : [],
    developmentAreas: Array.isArray(body.developmentAreas)
      ? body.developmentAreas.map((s) => sanitizeText(s, 120)).filter(Boolean)
      : [],
    propertyTypes: Array.isArray(body.propertyTypes)
      ? body.propertyTypes.filter((p) => PROPERTY_TYPES.includes(p))
      : [],
    budgetRange: {
      min: Math.max(0, Number(body.budgetRange?.min) || 0),
      max: Math.max(0, Number(body.budgetRange?.max) || 0),
    },

    operatingLocations,
    logo: sanitizeText(body.logo, 500),
    bio: sanitizeText(body.bio, 2000),
  };

  let profile = await BuilderProfile.findOne({ userId: user._id });

  if (!profile) {
    profile = await BuilderProfile.create({ userId: user._id, ...profileData });
  } else {
    Object.assign(profile, profileData);
    await profile.save();
  }

  // If PAN provided, mark pan verification as submitted
  if (profileData.pan && profile.verification.pan === "pending") {
    profile.verification.pan = "submitted";
    await profile.save();
  }
  if (profileData.gstin && profile.verification.gst === "pending") {
    profile.verification.gst = "submitted";
    await profile.save();
  }
  if (profileData.cin || profileData.llpin) {
    if (profile.verification.mca === "pending") {
      profile.verification.mca = "submitted";
      await profile.save();
    }
  }
  if (profileData.companyName && profile.verification.business === "pending") {
    profile.verification.business = "submitted";
    await profile.save();
  }

  return ok({ profile: profile.toObject(), message: "Profile saved successfully." });
});

export async function DELETE() {
  return fail("Not supported.", 405);
}
