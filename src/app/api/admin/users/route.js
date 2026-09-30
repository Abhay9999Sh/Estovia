import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import User from "@/lib/models/User";
import BuilderProfile from "@/lib/models/BuilderProfile";
import SupplierProfile from "@/lib/models/SupplierProfile";
import BuyerProfile from "@/lib/models/BuyerProfile";
import LandownerProfile from "@/lib/models/LandownerProfile";
import {
  VERIFIED_ROLES,
  REVIEWABLE_STATUSES,
  ALL_FIELD_STATUSES,
  fieldsForRole,
  ownerOfField,
  fieldPath,
  summarizeRoleVerification,
  displayStatus,
} from "@/lib/verification";

const PROFILE_MODELS = {
  landowner: LandownerProfile,
  builder: BuilderProfile,
  supplier: SupplierProfile,
  buyer: BuyerProfile,
};

const ACCOUNT_STATUSES = ["active", "suspended", "deactivated"];

/** Composite filters that mean more than one literal field status. */
const VERIFICATION_GROUPS = {
  needs_action: REVIEWABLE_STATUSES,
  needs_info: ["needs_information", "rejected"],
};

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
};

/** Escape a user string for safe use inside a RegExp. */
function toRegExp(q) {
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

/**
 * A predicate matching "this field is in one of `statuses`", on whichever
 * document owns it: a profile field lives at `fieldPath`, a user-owned field at
 * `verification.<field>`.
 *
 * A missing value reads as `pending`, so a `pending`-only match must also match
 * null; every other status is an exact match, or `?verification=verified` would
 * also return every user who never submitted anything.
 */
function fieldStatusClause(role, field, statuses) {
  const path =
    ownerOfField(role, field) === "user" ? `verification.${field}` : fieldPath(role, field);
  if (!path) return null;
  if (statuses.length === 1 && statuses[0] === "pending") {
    return { [path]: { $in: ["pending", null] } };
  }
  return { [path]: { $in: statuses } };
}

/**
 * User ids that have at least one verification field in one of `statuses`,
 * across the given roles.
 *
 * A field is stored either on the role profile or on the User, depending on
 * `ownerOfField`, so both collections have to be consulted. Doing it as two
 * targeted queries per role keeps this a real database filter: the user list can
 * then page and count correctly instead of loading every user to decide.
 */
async function userIdsWithFieldStatus(roles, statuses) {
  const ids = new Set();
  const list = Array.isArray(statuses) ? statuses : [statuses];

  for (const role of roles) {
    const Model = PROFILE_MODELS[role];

    const profileClauses = fieldsForRole(role)
      .filter((f) => ownerOfField(role, f) === "profile")
      .map((f) => fieldStatusClause(role, f, list))
      .filter(Boolean);
    if (profileClauses.length) {
      const docs = await Model.find({ $or: profileClauses }).select("userId").lean();
      for (const d of docs) if (d.userId) ids.add(String(d.userId));
    }

    const userClauses = fieldsForRole(role)
      .filter((f) => ownerOfField(role, f) === "user")
      .map((f) => fieldStatusClause(role, f, list))
      .filter(Boolean);
    if (userClauses.length) {
      const docs = await User.find({ $or: userClauses }).select("_id").lean();
      for (const d of docs) ids.add(String(d._id));
    }
  }

  return [...ids];
}

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status, role } = parseSearch(request.nextUrl.searchParams);
  const params = request.nextUrl.searchParams;
  const { page, limit, skip } = parsePagination(params, 20, 100);
  const sort = (params.get("sort") || "newest").trim();
  const verification = (params.get("verification") || "all").trim();

  if (role && role !== "all" && !["viewer", ...VERIFIED_ROLES, "admin"].includes(role)) {
    return fail(`Invalid role "${role}".`, 400);
  }
  if (status && status !== "all" && !ACCOUNT_STATUSES.includes(status) && !status.startsWith("profile_")) {
    return fail(`Invalid status "${status}".`, 400);
  }
  if (
    verification !== "all" &&
    !VERIFICATION_GROUPS[verification] &&
    !ALL_FIELD_STATUSES.includes(verification)
  ) {
    return fail(`Invalid verification filter "${verification}".`, 400);
  }
  if (sort !== "all" && !SORTS[sort]) return fail(`Invalid sort "${sort}".`, 400);

  const filter = {};

  if (role === "all") {
    filter.roles = { $nin: ["admin"] };
  } else if (role) {
    filter.roles = role;
  }

  if (status && status !== "all") {
    if (ACCOUNT_STATUSES.includes(status)) filter.accountStatus = status;
    else if (status === "profile_pending") filter.profileCompleted = false;
    else if (status === "profile_completed") filter.profileCompleted = true;
  }

  if (q) {
    const re = toRegExp(q);
    filter.$or = [{ name: re }, { username: re }, { email: re }, { phone: re }];
  }

  // Verification filter, restricted to the roles actually in scope.
  if (verification !== "all") {
    const scopedRoles = role && role !== "all" && PROFILE_MODELS[role] ? [role] : VERIFIED_ROLES;
    const statuses = VERIFICATION_GROUPS[verification] || [verification];
    const ids = await userIdsWithFieldStatus(scopedRoles, statuses);
    // No match means the result set is empty; a bare `$in: []` would be
    // dropped by the driver, so match nothing explicitly.
    filter._id = { $in: ids.length ? ids : ["000000000000000000000000"] };
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort(SORTS[sort] || SORTS.newest)
      .skip(skip)
      .limit(limit)
      .select(
        "name username email phone roles profileCompleted accountStatus avatar createdAt verification verificationMeta"
      )
      .lean(),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u) => u._id);

  // Load each scoped role profile once, keyed by user, so a user with more than
  // one role keeps all of them. The previous version stored a single `role` per
  // user, so the last role in the loop silently overwrote the others.
  const profilesByUser = new Map(userIds.map((id) => [String(id), {}]));
  await Promise.all(
    VERIFIED_ROLES.map(async (r) => {
      if (!userIds.length) return;
      const docs = await PROFILE_MODELS[r]
        .find({ userId: { $in: userIds } })
        .lean();
      for (const d of docs) {
        const bucket = profilesByUser.get(String(d.userId));
        if (bucket) bucket[r] = d;
      }
    })
  );

  const enriched = users.map((u) => {
    const profiles = profilesByUser.get(String(u._id)) || {};
    const verificationByRole = VERIFIED_ROLES.map((r) =>
      summarizeRoleVerification(r, profiles[r] || null, u)
    ).filter(Boolean);

    return {
      ...u,
      // Kept for the list table's onboarding column.
      profile: Object.fromEntries(
        VERIFIED_ROLES.filter((r) => profiles[r]).map((r) => [
          r,
          { onboardingComplete: !!profiles[r].onboardingComplete },
        ])
      ),
      verificationByRole,
      // Flat roll-up so the table can sort/filter without walking the roles.
      verificationOverall: verificationByRole.some((v) => v.needsReview)
        ? "under_review"
        : verificationByRole.some((v) => v.awaitingUser)
        ? "needs_information"
        : verificationByRole.some((v) => v.overall === "verified")
        ? "verified"
        : verificationByRole.length
        ? "pending"
        : "none",
      needsAction: verificationByRole.some((v) => v.needsReview),
      needsInfo: verificationByRole.some((v) => v.awaitingUser),
    };
  });

  return ok({
    users: enriched,
    total,
    page,
    limit,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    options: {
      roles: ["viewer", ...VERIFIED_ROLES],
      accountStatuses: ACCOUNT_STATUSES,
      verification: ["all", "needs_action", "needs_info", ...ALL_FIELD_STATUSES],
      sorts: Object.keys(SORTS),
    },
    labels: { verification: displayStatus(verification) },
  });
});
