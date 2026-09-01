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

const TO_NEW = { verified: "verified", rejected: "rejected", under_review: "submitted" };
const ALLOWED = ["verified", "rejected", "under_review"];

export const PATCH = withErrorHandling(async (request, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const role = (request.nextUrl.searchParams.get("role") || "").trim();

  if (!mongoose.isValidObjectId(id)) return fail("Invalid item.", 400);
  const Model = PROFILE_MODELS[role];
  if (!Model) return fail("Invalid role.", 400);

  const body = await request.json();
  await connectDB();

  const field = sanitizeText(body.field, 40);
  const status = sanitizeText(body.status, 40);
  const note = sanitizeText(body.note, 1000);

  if (!field) return fail("Please specify which field to review.", 400);
  if (!ALLOWED.includes(status)) return fail("Invalid status.", 400);
  if (status === "rejected" && !note) {
    return fail("A reason is required when rejecting.", 400);
  }

  const profile = await Model.findOne({ userId: id });
  if (!profile) return fail("Profile not found.", 404);

  const prev = extractStatus(profile, role, field);
  if (!prev) return fail("Unrecognised field for this role.", 400);

  applyStatus(profile, role, field, status);
  profile.reviewedBy = admin._id;
  profile.reviewedAt = new Date();
  profile.reviewNotes = note || profile.reviewNotes || "";
  await profile.save();

  if (role === "landowner") {
    const user = await User.findById(id);
    if (user) {
      const mapped = TO_NEW[status] || user.verification[field];
      if (field === "identity" || field === "address" || field === "phone") {
        await User.findByIdAndUpdate(id, { [`verification.${field}`]: mapped }, { new: true });
      }
    }
  }

  audit({
    actor: admin._id,
    actorRole: "admin",
    entity: `verification_${role}`,
    entityId: String(profile._id),
    action: `verification_${status}`,
    previousStatus: prev,
    newStatus: status,
    reason: note,
    metadata: { role, field },
  });

  await createNotification({
    userId: id,
    type: "verification_updated",
    title: status === "verified" ? "Verification approved" : status === "rejected" ? "Verification rejected" : "Verification under review",
    message:
      status === "rejected"
        ? `Your ${field} verification was rejected. ${note ? "Reason: " + note : ""}`
        : `Your ${field} verification has been ${status}.`,
    link: "/account",
    metadata: { field, status, note },
  });

  const updated = await User.findById(id).select("name username email roles verification accountStatus").lean();
  return ok({ user: updated, message: `Verification updated to ${status}.`, previousStatus: prev });
});

function extractStatus(profile, role, field) {
  if (role === "landowner") {
    if (field === "identity") return profile.identityDocument?.status || "pending";
    return "submitted";
  }
  return profile.verification?.[field] || "pending";
}

function applyStatus(profile, role, field, status) {
  if (role === "landowner") {
    if (field === "identity") {
      profile.identityDocument.status = status;
    }
    return;
  }
  profile.verification[field] = status;
}