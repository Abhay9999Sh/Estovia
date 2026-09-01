import { requireAuth, hasRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import LandownerProfile from "@/lib/models/LandownerProfile";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { isValidIndianPhone, PHONE_ERROR } from "@/lib/phone";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const profile = await LandownerProfile.findOne({ userId: user._id }).lean();
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

  const allowedOwnershipTypes = ["individual", "joint", "company", "trust"];

  const ownershipType = allowedOwnershipTypes.includes(body.ownershipType)
    ? body.ownershipType
    : "individual";

  const coOwners = Array.isArray(body.coOwners)
    ? body.coOwners
        .filter((c) => c && (c.name || "").trim())
        .map((c) => ({
          name: sanitizeText(c.name, 120),
          relationship: sanitizeText(c.relationship, 60),
          ownershipPercentage: Math.min(
            100,
            Math.max(0, Number(c.ownershipPercentage) || 0)
          ),
        }))
    : [];

  const pan = sanitizeText(body.pan, 20).toUpperCase();

  const profileData = {
    fullName: sanitizeText(body.fullName, 120),
    phone,
    email: sanitizeText(body.email, 120),
    dob: body.dob ? new Date(body.dob) : null,
    address: sanitizeText(body.address, 400),
    avatar: sanitizeText(body.avatar, 500),
    pan,
    identityDocument: body.identityDocument || {},
    ownershipType,
    coOwners,
  };

  let profile = await LandownerProfile.findOne({ userId: user._id });

  if (!profile) {
    profile = await LandownerProfile.create({
      userId: user._id,
      ...profileData,
    });
  } else {
    Object.assign(profile, profileData);
    await profile.save();
  }

  // If identity details provided, mark identity as submitted
  if (pan) {
    profile.identityDocument.status = "submitted";
    await profile.save();
  }

  const becomeLandowner = body.becomeLandowner === true;

  if (becomeLandowner && !hasRole(user, "landowner")) {
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { roles: "landowner" },
    });
  }

  return ok({ profile, message: "Profile saved successfully." });
});

export async function DELETE() {
  return fail("Not supported.", 405);
}
