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
  ALL_FIELD_STATUSES,
  REVIEWABLE_STATUSES,
  VERIFICATION_STATUSES,
  fieldsForRole,
  fieldPath,
  fieldLabel,
  ownerOfField,
  documentForField,
  readAllStatuses,
  getMeta,
  evidenceFor,
  hasEvidence,
} from "@/lib/verification";

const PROFILE_MODELS = {
  landowner: LandownerProfile,
  builder: BuilderProfile,
  supplier: SupplierProfile,
  buyer: BuyerProfile,
};

const SORTS = {
  newest: "recent",
  oldest: "oldest",
  role: "role",
  status: "status",
  name: "name",
};

const SEVERITY = { rejected: 0, needs_information: 1, under_review: 2, submitted: 3 };

/** Escape a user string for safe use inside a RegExp. */
function toRegExp(q) {
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

/**
 * Flat queue of verification items across all role profiles. Each item is one
 * field awaiting a decision.
 *
 * Filtering happens in Mongo (status predicates live at known dotted paths) so
 * `total` and pagination are correct. The previous implementation loaded every
 * profile in every role, filtered in JS, then sliced - so page totals drifted
 * and the work grew with the whole collection.
 */
export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status, role } = parseSearch(request.nextUrl.searchParams);
  const params = request.nextUrl.searchParams;
  const { page, limit, skip } = parsePagination(params, 30, 100);

  const field = (params.get("field") || "").trim();
  const sort = (params.get("sort") || "newest").trim();
  const accountStatus = (params.get("accountStatus") || "").trim();
  const evidenceOnly = params.get("withEvidence") === "true";

  if (role && role !== "all" && !PROFILE_MODELS[role]) {
    return fail("Invalid role.", 400);
  }
  if (status && status !== "all" && !ALL_FIELD_STATUSES.includes(status)) {
    return fail(`Invalid status "${status}".`, 400);
  }
  const sortKey = SORTS[sort] || SORTS.newest;

  const wantedRoles = role && role !== "all" ? [role] : VERIFIED_ROLES;

  // A specific field narrows the queue to that field; otherwise the queue is
  // every reviewable field of every selected role.
  const reviewableOnly = !status || status === "all";

  const items = [];
  const counts = { total: 0, byRole: {}, byStatus: {} };

  for (const r of wantedRoles) {
    const Model = PROFILE_MODELS[r];
    const roleFields = fieldsForRole(r).filter((f) => !field || f === field);
    if (!roleFields.length) continue;

    // Build a Mongo predicate for "a profile has at least one field in the
    // wanted state", so we only load profiles that can produce a row.
    const profileFields = roleFields.filter((f) => ownerOfField(r, f) === "profile");
    const userFields = roleFields.filter((f) => ownerOfField(r, f) === "user");

    const wanted = reviewableOnly ? REVIEWABLE_STATUSES : [status];

    // Only pre-filter the profile collection when at least one profile-owned
    // field is in play. A query like `?field=phone` resolves on `User`, so the
    // profile side must stay unfiltered and the inner loop decides.
    const orClauses = profileFields.map((f) => ({ [fieldPath(r, f)]: { $in: wanted } }));
    const profileFilter = profileFields.length ? { $or: orClauses } : {};

    const profiles = await Model.find(profileFilter).lean();
    if (!profiles.length) continue;

    const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) } })
      .select("name username email phone roles accountStatus verification verificationMeta createdAt")
      .lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    for (const p of profiles) {
      const u = userById.get(String(p.userId));
      if (!u) continue;

      if (accountStatus && accountStatus !== "all" && (u.accountStatus || "active") !== accountStatus) {
        continue;
      }

      if (userFields.length) {
        // A user-owned field (phone/address) resolves on `User`, so check the
        // wanted state there before emitting a row.
        const matchesUserField = userFields.some((f) => {
          const value = u.verification?.[f] || "pending";
          return reviewableOnly ? REVIEWABLE_STATUSES.includes(value) : value === status;
        });
        if (!matchesUserField) continue;
      }

      if (q) {
        const re = toRegExp(q);
        const haystack = [
          u.name,
          u.username,
          u.email,
          p.fullName,
          p.ownerName,
          p.companyName,
          p.businessName,
          p.pan,
          p.gstin,
          p.cin,
          p.llpin,
          p.udyam,
          p.phone,
          p.email,
        ]
          .filter(Boolean)
          .join(" ");
        if (!re.test(haystack)) continue;
      }

      const statuses = readAllStatuses(r, p, u);

      for (const f of roleFields) {
        const value = statuses[f] || "pending";
        if (reviewableOnly ? !REVIEWABLE_STATUSES.includes(value) : value !== status) continue;

        const container = documentForField(r, f, p, u);
        const meta = getMeta(container, f);
        const evidence = evidenceFor(r, f, p, u);
        if (evidenceOnly && !hasEvidence(r, f, p, u)) continue;

        counts.total += 1;
        counts.byRole[r] = (counts.byRole[r] || 0) + 1;
        counts.byStatus[value] = (counts.byStatus[value] || 0) + 1;

        items.push({
          role: r,
          profileId: p._id,
          userId: u._id,
          name: u.name || p.fullName || p.ownerName || u.username,
          username: u.username,
          email: u.email,
          phone: u.phone,
          field: f,
          label: fieldLabel(f),
          status: value,
          note: meta.note,
          previousStatus: meta.previousStatus,
          submittedAt: meta.submittedAt,
          reviewedAt: meta.reviewedAt,
          accountStatus: u.accountStatus || "active",
          hasEvidence: hasEvidence(r, f, p, u),
          evidence,
          updatedAt: meta.reviewedAt || p.updatedAt || p.createdAt || null,
        });
      }
    }
  }

  // Sorting happens after assembly because one queue row spans two collections.
  if (sortKey === "oldest") {
    items.sort((a, b) => new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
  } else if (sortKey === "name") {
    items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  } else if (sortKey === "role") {
    items.sort(
      (a, b) =>
        VERIFIED_ROLES.indexOf(a.role) - VERIFIED_ROLES.indexOf(b.role) ||
        String(a.name || "").localeCompare(String(b.name || ""))
    );
  } else if (sortKey === "status") {
    items.sort(
      (a, b) =>
        (SEVERITY[a.status] ?? 9) - (SEVERITY[b.status] ?? 9) ||
        new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    );
  } else {
    items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }

  const total = items.length;
  const pageItems = items.slice(skip, skip + limit);

  return ok({
    items: pageItems,
    total,
    page,
    limit,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    counts,
    filters: {
      role: role || "all",
      status: status || "all",
      field: field || "all",
      sort,
      accountStatus: accountStatus || "all",
    },
    // Options the UI renders, derived from the config so they cannot drift.
    options: {
      roles: VERIFIED_ROLES,
      statuses: VERIFICATION_STATUSES,
      sorts: Object.keys(SORTS),
      fieldsByRole: Object.fromEntries(VERIFIED_ROLES.map((r) => [r, fieldsForRole(r)])),
    },
  });
});
