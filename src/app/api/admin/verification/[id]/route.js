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
import {
  ROLE_VERIFICATION,
  ADMIN_ACTION_STATUSES,
  REASON_REQUIRED_STATUSES,
  ROLE_SELF_ROUTES,
  fieldsForRole,
  isValidField,
  fieldLabel,
  documentForField,
  setMeta,
  getMeta,
  evidenceFor,
  deriveOverall,
  displayStatus,
} from "@/lib/verification";

const PROFILE_MODELS = {
  landowner: LandownerProfile,
  builder: BuilderProfile,
  supplier: SupplierProfile,
  buyer: BuyerProfile,
};

/** Guard against a client posting a huge `items` array. */
const MAX_BULK = 12;

function resolveRole(role) {
  const Model = PROFILE_MODELS[role];
  if (!Model || !ROLE_VERIFICATION[role]) return null;
  return Model;
}

/**
 * Apply one review decision, writing both the status and its review record.
 * Returns `{ field, previousStatus, status, note }` for auditing.
 */
function applyDecision(role, profile, user, decision, admin) {
  const { field, status } = decision;

  const previousStatus = ROLE_VERIFICATION[role].read(profile, user, field);

  ROLE_VERIFICATION[role].write(profile, user, field, status);

  const container = documentForField(role, field, profile, user);
  setMeta(container, field, {
    status,
    previousStatus,
    // A rejection reason must never be erased by a later bare "verified".
    note: decision.note || (status === "verified" ? "" : getMeta(container, field).note),
    reviewedBy: admin._id,
    reviewedAt: new Date(),
  });

  return { field, previousStatus, status, note: decision.note || "" };
}

function notificationCopy(status, field, note) {
  const label = fieldLabel(field);
  if (status === "verified") {
    return {
      title: `${label} verified`,
      message: `Your ${label} has been verified.`,
    };
  }
  if (status === "rejected") {
    return {
      title: `${label} rejected`,
      message: `Your ${label} verification was rejected. Reason: ${note}`,
    };
  }
  if (status === "needs_information") {
    return {
      title: `${label} needs more information`,
      message: `We still need something for your ${label}. Please provide: ${note}`,
    };
  }
  return {
    title: `${label} under review`,
    message: `Your ${label} verification is now under review.`,
  };
}

/**
 * Everything an admin needs to review one user's verification for one role:
 * who they are, what they submitted, what is outstanding, and the current
 * status plus any reason already recorded against each field.
 */
export const GET = withErrorHandling(async (request, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const role = (request.nextUrl.searchParams.get("role") || "").trim();

  if (!mongoose.isValidObjectId(id)) return fail("Invalid item.", 400);
  const Model = resolveRole(role);
  if (!Model) return fail("Invalid role.", 400);

  await connectDB();

  const user = await User.findById(id)
    .select("name username email phone address roles accountStatus profileCompleted createdAt verification verificationMeta")
    .lean();
  if (!user) return fail("User not found.", 404);

  const profile = await Model.findOne({ userId: id }).lean();
  if (!profile) return fail("Profile not found.", 404);

  const statuses = {};
  for (const field of fieldsForRole(role)) {
    statuses[field] = ROLE_VERIFICATION[role].read(profile, user, field);
  }

  const fields = fieldsForRole(role).map((field) => {
    const container = documentForField(role, field, profile, user);
    const meta = getMeta(container, field);
    return {
      field,
      label: fieldLabel(field),
      status: statuses[field],
      note: meta.note,
      previousStatus: meta.previousStatus,
      submittedAt: meta.submittedAt,
      reviewedAt: meta.reviewedAt,
      reviewedBy: meta.reviewedBy,
      evidence: evidenceFor(role, field, profile, user),
    };
  });

  // `reviewedBy` is stored as an admin id; the review UI needs a name, so the
  // distinct reviewers are resolved once rather than per field.
  const reviewerIds = [...new Set(fields.map((f) => f.reviewedBy).filter(Boolean).map(String))];
  const reviewers = reviewerIds.length
    ? await User.find({ _id: { $in: reviewerIds } }).select("name username").lean()
    : [];
  const reviewerById = new Map(reviewers.map((r) => [String(r._id), r.name || r.username || "Admin"]));
  for (const f of fields) {
    f.reviewedByName = f.reviewedBy ? reviewerById.get(String(f.reviewedBy)) || "Admin" : null;
  }

  // Identity and contact details shown in the review header.
  const identity = {
    name: user.name || profile.fullName || profile.ownerName || user.username,
    username: user.username,
    email: user.email,
    phone: user.phone,
    roles: user.roles || [],
    accountStatus: user.accountStatus || "active",
    joinedAt: user.createdAt || null,
    profileCompleted: !!user.profileCompleted,
    organisation:
      profile.companyName || profile.businessName || profile.fullName || profile.ownerName || "",
  };

  return ok({
    role,
    userId: user._id,
    profileId: profile._id,
    identity,
    fields,
    overall: deriveOverall(statuses),
    // A summary of the role profile, so the modal does not need a second call.
    summary: {
      onboardingComplete: !!profile.onboardingComplete,
      businessType: profile.businessType || "",
      designation: profile.designation || "",
      category: profile.category || "",
      companyDocuments: profile.companyDocuments || profile.documents || [],
      ownershipType: profile.ownershipType || "",
      reviewNotes: profile.reviewNotes || "",
      reviewedAt: profile.reviewedAt || null,
      updatedAt: profile.updatedAt || null,
    },
  });
});

/**
 * Review one or more verification fields for a user.
 *
 * Body: `{ role, field, status, note }` for a single decision, or
 * `{ role, items: [{ field, status, note }] }` for a bulk action.
 *
 * `role` may also arrive as `?role=`, which is how the existing admin UI calls
 * this endpoint.
 */
export const PATCH = withErrorHandling(async (request, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  if (!mongoose.isValidObjectId(id)) return fail("Invalid item.", 400);

  const body = await request.json();
  await connectDB();

  const role = (request.nextUrl.searchParams.get("role") || body.role || "").trim();
  const Model = resolveRole(role);
  if (!Model) return fail("Invalid role.", 400);

  // Normalise single and bulk forms into one list of decisions.
  const rawItems = Array.isArray(body.items) && body.items.length ? body.items : [body];
  if (rawItems.length > MAX_BULK) {
    return fail(`You can review at most ${MAX_BULK} items at once.`, 400);
  }

  const decisions = [];
  for (const raw of rawItems) {
    const field = sanitizeText(raw.field, 40);
    const status = sanitizeText(raw.status, 40);
    const note = sanitizeText(raw.note, 1000);

    if (!field) return fail("Please specify which field to review.", 400);

    // The previous version derived `previousStatus` with `read(...) || "pending"`,
    // which can never be falsy, so this check never fired and a typo'd field
    // silently returned 200 while mongoose dropped the write.
    if (!isValidField(role, field)) {
      return fail(
        `"${field}" is not a verification field for ${role}. Expected one of: ${fieldsForRole(role).join(", ")}.`,
        400
      );
    }
    if (!ADMIN_ACTION_STATUSES.includes(status)) {
      return fail(`Invalid status "${status}". Expected one of: ${ADMIN_ACTION_STATUSES.join(", ")}.`, 400);
    }
    if (REASON_REQUIRED_STATUSES.includes(status) && !note) {
      return fail(
        status === "rejected"
          ? "A reason is required when rejecting."
          : "Please tell the user what information is required.",
        400
      );
    }
    decisions.push({ field, status, note });
  }

  const profile = await Model.findOne({ userId: id });
  if (!profile) return fail("Profile not found.", 404);

  const user = await User.findById(id);
  if (!user) return fail("User not found.", 404);

  const applied = decisions.map((d) => applyDecision(role, profile, user, d, admin));

  // Profile-level summary of the most recent review, kept for the existing
  // list/detail views that render it.
  const lastDecision = applied[applied.length - 1];
  profile.reviewedBy = admin._id;
  profile.reviewedAt = new Date();
  profile.reviewNotes = lastDecision.note || profile.reviewNotes || "";

  await Promise.all([profile.save(), user.save()]);

  for (const a of applied) {
    audit({
      actor: admin._id,
      actorRole: "admin",
      entity: `verification_${role}`,
      entityId: String(profile._id),
      action: `verification_${a.status}`,
      previousStatus: a.previousStatus,
      newStatus: a.status,
      reason: a.note,
      metadata: { role, field: a.field, userId: String(user._id) },
    });
  }

  // One notification per distinct outcome, deep-linked to the page that
  // actually renders this role's status.
  const link = ROLE_SELF_ROUTES[role] || "/account";
  for (const a of applied) {
    const copy = notificationCopy(a.status, a.field, a.note);
    await createNotification({
      userId: user._id,
      type: "verification_updated",
      title: copy.title,
      message: copy.message,
      link,
      metadata: { role, field: a.field, status: a.status, note: a.note },
    });
  }

  // Return the post-write state of every field so the client can re-render
  // without a second round trip, instead of the raw user document (which for
  // most fields was never the document that changed).
  const fields = fieldsForRole(role).map((field) => {
    const container = documentForField(role, field, profile, user);
    const meta = getMeta(container, field);
    return {
      field,
      label: fieldLabel(field),
      status: ROLE_VERIFICATION[role].read(profile, user, field),
      note: meta.note,
      previousStatus: meta.previousStatus,
      reviewedAt: meta.reviewedAt,
      reviewedBy: meta.reviewedBy,
    };
  });

  return ok({
    role,
    userId: user._id,
    updated: applied.map((a) => ({ field: a.field, previousStatus: a.previousStatus, status: a.status })),
    fields,
    overall: deriveOverall(Object.fromEntries(fields.map((f) => [f.field, f.status]))),
    message:
      applied.length === 1
        ? `${fieldLabel(applied[0].field)} marked as ${displayStatus(applied[0].status)}.`
        : `${applied.length} items marked ${displayStatus(lastDecision.status)}.`,
  });
});
