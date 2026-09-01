import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerProfile from "@/lib/models/BuyerProfile";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { isValidIndianPhone, PHONE_ERROR } from "@/lib/phone";

const BUYER_TYPES = ["Individual", "Family", "Developer", "Investor", "NRI", "Other", ""];

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const profile = await BuyerProfile.findOne({ userId: user._id }).lean();
  return ok({ profile: profile || null });
});

export const PUT = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();

  const phone = sanitizeText(body.phone, 20).replace(/[\s\-()]/g, "").trim();
  if (phone && !isValidIndianPhone(phone)) {
    return fail(PHONE_ERROR, 400);
  }

  const buyerType = BUYER_TYPES.includes(body.buyerType) ? body.buyerType : "";

  const profileData = {
    fullName: sanitizeText(body.fullName, 120),
    phone,
    email: sanitizeText(body.email, 120),
    avatar: sanitizeText(body.avatar, 500),
    about: sanitizeText(body.about, 2000),
    buyerType,
    nationality: sanitizeText(body.nationality, 80),
    address: sanitizeText(body.address, 500),
    pan: sanitizeText(body.pan, 20).toUpperCase(),
    preferences: {
      propertyTypes: Array.isArray(body.preferences?.propertyTypes)
        ? body.preferences.propertyTypes.map((s) => sanitizeText(s, 80)).filter(Boolean)
        : body.preferences?.propertyTypes || [],
      budgetRange: {
        min: Math.max(0, Number(body.preferences?.budgetRange?.min) || 0),
        max: Math.max(0, Number(body.preferences?.budgetRange?.max) || 0),
      },
      locations: Array.isArray(body.preferences?.locations)
        ? body.preferences.locations.map((s) => sanitizeText(s, 100)).filter(Boolean)
        : [],
      preferredState: sanitizeText(body.preferences?.preferredState, 80),
      preferredCity: sanitizeText(body.preferences?.preferredCity, 80),
      possessionTimeline: sanitizeText(body.preferences?.possessionTimeline, 120),
    },
  };

  let profile = await BuyerProfile.findOne({ userId: user._id });
  if (!profile) {
    profile = await BuyerProfile.create({ userId: user._id, ...profileData });
  } else {
    Object.assign(profile, profileData);
    await profile.save();
  }

  if (profileData.pan && profile.verification.pan === "pending") {
    profile.verification.pan = "submitted";
    await profile.save();
  }

  return ok({ profile: profile.toObject(), message: "Profile saved successfully." });
});

export async function DELETE() {
  return fail("Not supported.", 405);
}
