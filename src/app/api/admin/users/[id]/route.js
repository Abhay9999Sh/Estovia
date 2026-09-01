import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import mongoose from "mongoose";
import User from "@/lib/models/User";
import BuilderProfile from "@/lib/models/BuilderProfile";
import SupplierProfile from "@/lib/models/SupplierProfile";
import BuyerProfile from "@/lib/models/BuyerProfile";
import LandownerProfile from "@/lib/models/LandownerProfile";

const PROFILE_MODELS = {
  landowner: LandownerProfile,
  builder: BuilderProfile,
  supplier: SupplierProfile,
  buyer: BuyerProfile,
};

function safeUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

export const GET = withErrorHandling(async (request, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Invalid user.", 400);
  await connectDB();

  const user = await User.findById(id).lean();
  if (!user) return fail("User not found.", 404);

  const [landowner, builder, supplier, buyer, listings, applications, orders, interests, reports] =
    await Promise.all([
      LandownerProfile.findOne({ userId: id }).lean(),
      BuilderProfile.findOne({ userId: id }).lean(),
      SupplierProfile.findOne({ userId: id }).lean(),
      BuyerProfile.findOne({ userId: id }).lean(),
      id ? import("@/lib/models/LandListing").then(({ default: M }) => M.find({ ownerId: id }).sort({ createdAt: -1 }).limit(20).lean()) : [],
      id ? import("@/lib/models/BuyerApplication").then(({ default: M }) => M.find({ buyerId: id }).sort({ createdAt: -1 }).limit(20).lean()) : [],
      id ? import("@/lib/models/Order").then(({ default: M }) => M.find({ $or: [{ builderId: id }] }).sort({ createdAt: -1 }).limit(20).lean()) : [],
      id ? import("@/lib/models/Interest").then(({ default: M }) => M.find({ interestedUserRef: id }).sort({ createdAt: -1 }).limit(20).lean()) : [],
      id ? import("@/lib/models/Report").then(({ default: M }) => M.find({ reporterId: id }).sort({ createdAt: -1 }).limit(20).lean()) : [],
    ]);

  return ok({
    user: safeUser(user),
    profiles: { landowner, builder, supplier, buyer },
    listings,
    applications,
    orders,
    interests,
    reports,
  });
});

export const PATCH = withErrorHandling(async (request, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Invalid user.", 400);

  const body = await request.json();
  await connectDB();

  const model = PROFILE_MODELS[body.role] || null;

  const user = await User.findById(id);
  if (!user) return fail("User not found.", 404);
  if (user.roles?.includes("admin") && String(user._id) !== String(admin._id)) {
    return fail("You cannot modify another admin account.", 403);
  }

  const validActions = ["suspend", "reactivate", "deactivate", "verify_profile", "mark_profile_incomplete"];
  if (!validActions.includes(body.action)) return fail("Invalid action.", 400);
  const reason = sanitizeText(body.reason, 500);

  const prevStatus = user.accountStatus || "active";
  const prevCompleted = user.profileCompleted;

  if (body.action === "suspend") {
    if (user.accountStatus === "suspended") {
      return fail("Account is already suspended.", 400);
    }
    user.accountStatus = "suspended";
    await user.save();
  } else if (body.action === "reactivate") {
    if (user.accountStatus === "active") {
      return fail("Account is already active.", 400);
    }
    user.accountStatus = "active";
    await user.save();
  } else if (body.action === "deactivate") {
    if (user.accountStatus === "deactivated") {
      return fail("Account is already deactivated.", 400);
    }
    user.accountStatus = "deactivated";
    await user.save();
  } else if (body.action === "verify_profile") {
    if (!model) return fail("A role is required to verify a profile.", 400);
    const profile = await model.findOne({ userId: id });
    if (!profile) return fail("Profile not found for this user.", 404);
    profile.reviewedBy = admin._id;
    profile.reviewedAt = new Date();
    profile.reviewNotes = reason || profile.reviewNotes;
    await profile.save();
  } else if (body.action === "mark_profile_incomplete") {
    user.profileCompleted = false;
    await user.save();
  }

  audit({
    actor: admin._id,
    actorRole: "admin",
    entity: "user",
    entityId: String(user._id),
    action: `admin_${body.action}`,
    previousStatus: prevStatus,
    newStatus:
      body.action === "suspend" ? "suspended"
      : body.action === "reactivate" ? "active"
      : body.action === "deactivate" ? "deactivated"
      : body.action === "verify_profile" ? (prevCompleted ? "completed" : "profile_verified") : "",
    reason,
  });

  await createNotification({
    userId: id,
    type: "verification_updated",
    title:
      body.action === "suspend" ? "Account suspended"
      : body.action === "deactivate" ? "Account deactivated"
      : body.action === "reactivate" ? "Account reactivated"
      : "Profile updated",
    message: sanitizeText(body.message, 500) || (reason ? `${body.action} — ${reason}` : `Your account was ${body.action}.`),
    link: "/account",
  });

  const updated = await User.findById(id).lean();
  return ok({ user: safeUser(updated), message: "User updated successfully." });
});