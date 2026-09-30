/**
 * Shared verification configuration and helpers for Estovia.
 *
 * Single source of truth for:
 *  - the canonical verification statuses used across the platform,
 *  - which verification categories apply to each role,
 *  - how each category is read from / written to the underlying documents,
 *  - deriving a coarse "overall" verification status from granular fields.
 *
 * This module is intentionally safe to import from both server (API routes)
 * and client (React components) code. It performs no I/O.
 */

export const VERIFICATION_STATUSES = [
  "pending",
  "submitted",
  "under_review",
  "needs_information",
  "verified",
  "rejected",
];

/** Statuses that appear in the admin review queue. */
export const REVIEWABLE_STATUSES = [
  "submitted",
  "under_review",
  "needs_information",
];

/**
 * Statuses an admin may set through the review queue.
 * `pending` is deliberately absent: resetting a field is a user action
 * (re-submission), so a review can never silently un-verify someone.
 */
export const ADMIN_ACTION_STATUSES = [
  "under_review",
  "needs_information",
  "verified",
  "rejected",
];

/** Statuses that require the admin to write a reason. */
export const REASON_REQUIRED_STATUSES = ["rejected", "needs_information"];

/** Every status a field can be in, for `?status=` validation. */
export const ALL_FIELD_STATUSES = [...VERIFICATION_STATUSES, ...REVIEWABLE_STATUSES];

/** Roles that participate in profile verification, in display order. */
export const VERIFIED_ROLES = ["landowner", "builder", "supplier", "buyer"];

/**
 * Where each role keeps its own verification status, so notifications can
 * deep-link the user to the page that actually renders their status.
 */
export const ROLE_SELF_ROUTES = {
  landowner: "/landowner/verification",
  builder: "/builder/verification",
  supplier: "/supplier/verification",
  buyer: "/buyer/verification",
};

export const OVERALL_STATUSES = [
  "pending",
  "partial",
  "under_review",
  "verified",
  "rejected",
];

export const FIELD_LABELS = {
  identity: "Identity",
  address: "Address",
  phone: "Phone",
  email: "Email",
  business: "Business",
  gst: "GST",
  pan: "PAN",
  mca: "MCA / CIN",
  udyam: "Udyam",
  rera: "RERA",
  ownership: "Ownership",
};

/**
 * Sort rank for a single field's status, worst first.
 *
 * The Admin tables and chips lead with whatever needs an admin's attention, so
 * `pending` outranks `verified` here. This is the inverse of
 * `overallRankExpr`'s rank, which exists to sort the derived overall state with
 * rejected first and verified last.
 */
const FIELD_ATTENTION_ORDER = [
  "rejected",
  "needs_information",
  "under_review",
  "submitted",
  "pending",
  "verified",
];

export function fieldAttentionRank(status) {
  const i = FIELD_ATTENTION_ORDER.indexOf(status);
  return i < 0 ? FIELD_ATTENTION_ORDER.length : i;
}

/** True when a field is waiting on an admin decision. */
export function needsReview(status) {
  return REVIEWABLE_STATUSES.includes(status);
}

/** True when a field is waiting on the *user* to act. */
export function awaitingUser(status) {
  return status === "needs_information" || status === "rejected";
}

/**
 * Which verification categories apply to each role, and how a given category
 * is read from the relevant documents.
 *
 * reads: (profile, user) => status-string
 * writes: (profile, user, status) => persisted result (no save() here)
 */
export const ROLE_VERIFICATION = {
  landowner: {
    fields: ["identity", "address", "phone"],
    // Which document holds the status: "profile" or "user".
    owners: { identity: "profile", address: "user", phone: "user" },
    // Dotted path of the status inside that document, so admin list routes can
    // build real Mongo filters instead of filtering in JavaScript.
    paths: {
      identity: "identityDocument.status",
      address: "verification.address",
      phone: "verification.phone",
    },
    read(profile, user, field) {
      if (field === "identity") return profile?.identityDocument?.status || "pending";
      return user?.verification?.[field] || "pending";
    },
    write(profile, user, field, status) {
      if (field === "identity" && profile) {
        profile.identityDocument = profile.identityDocument || {};
        profile.identityDocument.status = status;
      } else if (user) {
        user.verification[field] = status;
      }
    },
  },
  builder: {
    fields: ["phone", "business", "pan", "gst", "mca", "address"],
    owners: { phone: "user" },
    paths: {
      phone: "verification.phone",
      business: "verification.business",
      pan: "verification.pan",
      gst: "verification.gst",
      mca: "verification.mca",
      address: "verification.address",
    },
    read(profile, user, field) {
      if (field === "phone") return user?.verification?.phone || "pending";
      return profile?.verification?.[field] || "pending";
    },
    write(profile, user, field, status) {
      if (field === "phone") {
        if (user) user.verification.phone = status;
      } else if (profile) {
        profile.verification[field] = status;
      }
    },
  },
  supplier: {
    fields: ["phone", "business", "gst", "pan", "udyam", "address"],
    owners: { phone: "user" },
    paths: {
      phone: "verification.phone",
      business: "verification.business",
      gst: "verification.gst",
      pan: "verification.pan",
      udyam: "verification.udyam",
      address: "verification.address",
    },
    read(profile, user, field) {
      if (field === "phone") return user?.verification?.phone || "pending";
      return profile?.verification?.[field] || "pending";
    },
    write(profile, user, field, status) {
      if (field === "phone") {
        if (user) user.verification.phone = status;
      } else if (profile) {
        profile.verification[field] = status;
      }
    },
  },
  buyer: {
    fields: ["phone", "identity", "address", "pan"],
    owners: { phone: "user" },
    paths: {
      phone: "verification.phone",
      identity: "verification.identity",
      address: "verification.address",
      pan: "verification.pan",
    },
    read(profile, user, field) {
      if (field === "phone") return user?.verification?.phone || "pending";
      return profile?.verification?.[field] || "pending";
    },
    write(profile, user, field, status) {
      if (field === "phone") {
        if (user) user.verification.phone = status;
      } else if (profile) {
        profile.verification[field] = status;
      }
    },
  },
};

/** All fields a role can be verified on, or `[]` for an unknown role. */
export function fieldsForRole(role) {
  return ROLE_VERIFICATION[role]?.fields || [];
}

/** True when `field` is a real, reviewable field for `role`. */
export function isValidField(role, field) {
  return fieldsForRole(role).includes(field);
}

/** Which document ("profile" | "user") stores a role/field's status. */
export function ownerOfField(role, field) {
  return ROLE_VERIFICATION[role]?.owners?.[field] || "profile";
}

/** Dotted Mongo path of a role/field status, e.g. `verification.pan`. */
export function fieldPath(role, field) {
  return ROLE_VERIFICATION[role]?.paths?.[field] || null;
}

/**
 * The profile-model document for a role, or `null` for user-owned fields.
 * Kept here so admin routes and the UI agree on where state lives.
 */
export function documentForField(role, field, profile, user) {
  return ownerOfField(role, field) === "user" ? user : profile;
}

/**
 * Build a map of field -> status for a role from its documents.
 */
export function readAllStatuses(role, profile, user) {
  const cfg = ROLE_VERIFICATION[role];
  if (!cfg) return {};
  const out = {};
  for (const f of cfg.fields) out[f] = cfg.read(profile, user, f);
  return out;
}

/**
 * Summarise one role's verification for an admin list/detail screen: every
 * field's status, the derived overall, and the reason recorded against any
 * field that was rejected or needs more information.
 *
 * Kept in one place so the user detail page, the role list routes and the
 * dashboard cannot disagree about what a user's verification state is.
 *
 * @returns null when the user has no profile for the role.
 */
export function summarizeRoleVerification(role, profile, user) {
  if (!ROLE_VERIFICATION[role]) return null;
  if (!profile) return null;

  const statuses = readAllStatuses(role, profile, user);
  const fields = ROLE_VERIFICATION[role].fields.map((field) => {
    const meta = getMeta(documentForField(role, field, profile, user), field);
    return {
      field,
      label: fieldLabel(field),
      status: statuses[field] || "pending",
      note: meta.note || "",
      submittedAt: meta.submittedAt || null,
      reviewedAt: meta.reviewedAt || null,
      reviewedBy: meta.reviewedBy || null,
    };
  });

  return {
    role,
    hasProfile: true,
    statuses,
    fields,
    overall: deriveOverall(statuses),
    // Flat reasons keyed by field, for views that only need the "why".
    reasons: Object.fromEntries(
      fields.filter((f) => f.note).map((f) => [f.field, f.note])
    ),
    // True while anything is still waiting on the user, not on an admin.
    awaitingUser: fields.some((f) => f.status === "needs_information" || f.status === "rejected"),
    // True while anything is waiting on an admin decision.
    needsReview: fields.some((f) => REVIEWABLE_STATUSES.includes(f.status)),
    lastReviewedAt: profile.reviewedAt || null,
  };
}

/**
 * Derive a coarse overall verification status from granular field statuses.
 * Order of precedence: rejected > under_review > verified > partial > pending.
 */
export function deriveOverall(fields) {
  const values = Object.values(fields || {});
  if (!values.length) return "pending";
  if (values.includes("rejected")) return "rejected";
  if (values.some((v) => REVIEWABLE_STATUSES.includes(v))) return "under_review";
  if (values.every((v) => v === "verified")) return "verified";
  if (values.some((v) => v === "verified")) return "partial";
  return "pending";
}

export function displayStatus(status) {
  return String(status || "pending").replace(/_/g, " ");
}

export function fieldLabel(field) {
  return FIELD_LABELS[field] || String(field).replace(/_/g, " ");
}

/**
 * Title-case a role for display. `displayStatus` is right for statuses
 * (snake_case) but leaves a role as lowercase "landowner", which reads poorly
 * in a table header or a filter dropdown.
 */
export function roleLabel(role) {
  const s = String(role || "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ *
 * Mongo query construction
 *
 * `deriveOverall` is computed in JS, which is why the admin list routes used to
 * over-fetch a window of profiles, filter it in JS and then paginate - so
 * `total` was wrong and pages drifted. These builders translate a status filter
 * into a real Mongo predicate so the database can count and paginate correctly.
 * ------------------------------------------------------------------ */

/**
 * Mongo filter for "this user's overall verification is X".
 *
 * Mirrors `deriveOverall` exactly, in that precedence order
 * (rejected > under_review > verified > partial > pending), but expressed as a
 * query so the database can count and paginate correctly instead of the route
 * loading every profile and filtering in JavaScript.
 *
 * `userPrefix` is the dotted path where the joined `User` document's
 * verification block lives (e.g. `u` for a `$lookup` aliased as `u`), so
 * user-owned fields such as `phone` can participate. Pass `null` to ignore
 * user-owned fields, which is only correct when no role for that field can be
 * in a reviewable state.
 */
export function overallFilter(role, overall, userPrefix = null) {
  const cfg = ROLE_VERIFICATION[role];
  if (!cfg || !overall || overall === "all") return null;

  const joinPath = (prefix, rest) => {
    if (!prefix) return null;
    return prefix.endsWith(".") ? `${prefix}${rest}` : `${prefix}.${rest}`;
  };

  const paths = cfg.fields.map((f) =>
    ownerOfField(role, f) === "user"
      ? joinPath(userPrefix, `verification.${f}`)
      : cfg.paths[f]
  );
  const resolvable = paths.filter(Boolean);
  if (!resolvable.length) return null;

  const anyOf = (values) => ({ $or: resolvable.map((p) => ({ [p]: { $in: values } })) });
  const allOf = (value) => ({ $and: resolvable.map((p) => ({ [p]: value })) });

  const noRejection = { $nor: resolvable.map((p) => ({ [p]: "rejected" })) };
  const noReviewable = { $nor: resolvable.map((p) => ({ [p]: { $in: REVIEWABLE_STATUSES } })) };
  const anyVerified = anyOf(["verified"]);
  // "nothing is verified" -> pending
  const noneVerified = { $nor: resolvable.map((p) => ({ [p]: "verified" })) };
  // "at least one is not verified" -> used to separate partial from verified.
  // `$ne` also matches a missing document, which is what we want.
  const notAllVerified = { $or: resolvable.map((p) => ({ [p]: { $ne: "verified" } })) };

  switch (overall) {
    case "rejected":
      return anyOf(["rejected"]);
    case "under_review":
      return { $and: [noRejection, anyOf(REVIEWABLE_STATUSES)] };
    case "verified":
      return { $and: [noRejection, noReviewable, allOf("verified")] };
    case "partial":
      return { $and: [noRejection, noReviewable, anyVerified, notAllVerified] };
    case "pending":
      return { $and: [noRejection, noReviewable, noneVerified] };
    default:
      return null;
  }
}

/**
 * Predicate matching one field at a known status, used to filter the queue and
 * the role lists. A missing document counts as `pending`, matching `read()`.
 */
export function statusFilter(role, field, status) {
  const path = fieldPath(role, field);
  if (!path) return null;
  if (!status || status === "all") return {};
  // A missing document reads as `pending`, so `pending` must also match
  // null/missing. Every other status is an exact match, otherwise asking for
  // `pan=verified` would also return every profile that never set a PAN.
  if (status === "pending") return { [path]: { $in: ["pending", null] } };
  return { [path]: status };
}

/**
 * Resolved Mongo paths for a role's fields, user-owned ones prefixed with
 * `userPrefix`. Order matches `fieldsForRole`, so index parity is guaranteed.
 */
export function statusPaths(role, userPrefix = null) {
  const cfg = ROLE_VERIFICATION[role];
  if (!cfg) return [];
  const joinPath = (prefix, rest) =>
    !prefix ? null : prefix.endsWith(".") ? `${prefix}${rest}` : `${prefix}.${rest}`;
  return cfg.fields
    .map((f) =>
      ownerOfField(role, f) === "user"
        ? joinPath(userPrefix, `verification.${f}`)
        : cfg.paths[f]
    )
    .filter(Boolean);
}

/**
 * Mongo aggregation expression yielding `deriveOverall`'s precedence as a
 * sortable rank, so `?sort=verification` can order in the database:
 * 0 rejected, 1 under review, 2 partial, 3 pending, 4 verified.
 */
export function overallRankExpr(role, userPrefix = null) {
  const paths = statusPaths(role, userPrefix);
  if (!paths.length) return 4;

  // Built the same way as `overallFilter` (plain `$or`/`$and` over field
  // comparisons) because those predicates are proven against a live server,
  // whereas `$ifNull` inside a `$filter` input array does not evaluate
  // per-element. A missing field simply fails every comparison, so it falls
  // through to the default rank of 3, which is `pending` - matching `read()`.
  const at = (p, value) => ({ $eq: [`$${p}`, value] });
  const anyRejected = { $or: paths.map((p) => at(p, "rejected")) };
  const anyReviewable = { $or: paths.map((p) => ({ $in: [`$${p}`, REVIEWABLE_STATUSES] })) };
  const anyVerified = { $or: paths.map((p) => at(p, "verified")) };
  const allVerified = { $and: paths.map((p) => at(p, "verified")) };

  return {
    $switch: {
      branches: [
        { case: anyRejected, then: 0 },
        { case: anyReviewable, then: 1 },
        { case: allVerified, then: 4 },
        { case: anyVerified, then: 2 },
      ],
      default: 3,
    },
  };
}

/** User-owned fields for a role, for callers that must query User separately. */
export function userOwnedFields(role) {
  return fieldsForRole(role).filter((f) => ownerOfField(role, f) === "user");
}

/* ------------------------------------------------------------------ *
 * Per-field review metadata
 *
 * Statuses live in fixed paths (`verification.pan`, `identityDocument.status`,
 * `user.verification.phone`) and are read by lots of existing code, so they
 * stay exactly where they are. The *review record* for each field - the
 * rejection reason, who decided, when, and the evidence they saw - lives in a
 * parallel `verificationMeta` map on whichever document owns the status, keyed
 * by the same field name. Nothing here changes how a status is read.
 * ------------------------------------------------------------------ */

const EMPTY_META = {
  status: "pending",
  note: "",
  evidence: "",
  evidenceLabel: "",
  submittedAt: null,
  reviewedBy: null,
  reviewedAt: null,
  previousStatus: "",
};

/**
 * Read one field's review record, tolerating mongoose Maps, lean plain objects
 * and missing keys. Always returns a fully-populated object.
 */
export function getMeta(container, field) {
  const store = container?.verificationMeta;
  if (!store) return { ...EMPTY_META };
  let raw = null;
  if (typeof store.get === "function") {
    raw = store.get(field);
  } else if (typeof store === "object") {
    raw = store[field];
  }
  if (!raw) return { ...EMPTY_META };
  return {
    ...EMPTY_META,
    ...raw,
    submittedAt: raw.submittedAt || null,
    reviewedAt: raw.reviewedAt || null,
    reviewedBy: raw.reviewedBy || null,
  };
}

/**
 * Write a field's review record. Works on both mongoose documents (Map) and
 * plain objects, so it is safe in lean-only code paths.
 */
export function setMeta(container, field, patch) {
  if (!container) return;
  const next = { ...getMeta(container, field), ...patch };
  const store = container.verificationMeta;
  if (store && typeof store.set === "function") {
    store.set(field, next);
    return;
  }
  if (container.verificationMeta && typeof container.verificationMeta === "object") {
    container.verificationMeta[field] = next;
  }
}

/** Every field's review record for a role, as a plain object. */
export function readAllMeta(role, profile, user) {
  const out = {};
  for (const f of fieldsForRole(role)) {
    out[f] = getMeta(documentForField(role, f, profile, user), f);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Evidence
 *
 * What the user actually submitted for a given field. Admin cannot review a
 * PAN number they cannot see, so every queue row and every review packet
 * carries this. Each entry is `{ label, value, url }`; `value` may be empty
 * when the user has not supplied it yet.
 * ------------------------------------------------------------------ */

const ev = (label, value, url = "") => ({
  label,
  value: value == null ? "" : String(value).trim(),
  url: url || "",
});

/** Evidence a builder or supplier should see for a field. */
function companyEvidence(profile, field) {
  switch (field) {
    case "business":
      return [
        ev("Company / business name", profile?.companyName || profile?.businessName),
        ev("Business type", profile?.businessType),
        ev("Year established", profile?.yearEstablished),
        ev("Website", profile?.website),
        ...(profile?.companyDocuments || []).map((u, i) => ev(`Company document ${i + 1}`, "Uploaded", u)),
      ];
    case "pan":
      return [ev("PAN", profile?.pan), ev("Legal name", profile?.companyName || profile?.businessName)];
    case "gst":
      return [ev("GSTIN", profile?.gstin), ev("PAN", profile?.pan)];
    case "mca":
      return [
        ev("CIN", profile?.cin),
        ev("LLPIN", profile?.llpin),
        ev("Designation", profile?.designation),
      ];
    case "udyam":
      return [ev("Udyam registration", profile?.udyam), ev("PAN", profile?.pan)];
    case "address":
      return [
        ev("Registered address", profile?.registeredAddress),
        ev("Office address", profile?.officeAddress),
      ];
    default:
      return [];
  }
}

/**
 * Resolve the submitted evidence for one role/field.
 * Always returns an array of `{ label, value, url }`.
 */
export function evidenceFor(role, field, profile, user) {
  switch (role) {
    case "landowner":
      if (field === "identity") {
        return [
          ev("Document type", profile?.identityDocument?.type),
          ev("Document", "Uploaded", profile?.identityDocument?.url),
          ev("Full name", profile?.fullName),
          ev("PAN", profile?.pan),
          ev("Date of birth", profile?.dob),
        ];
      }
      if (field === "phone") return [ev("Phone", user?.phone), ev("Name", user?.name)];
      if (field === "address") return [ev("Address", user?.address)];
      return [];

    case "builder":
    case "supplier":
      if (field === "phone") {
        return [
          ev("Phone", user?.phone),
          ev("Account email", user?.email),
          ev("On file since", user?.createdAt),
        ];
      }
      return companyEvidence(profile, field);

    case "buyer":
      if (field === "phone") {
        return [ev("Phone", user?.phone), ev("Account email", user?.email)];
      }
      if (field === "identity") {
        const docs = profile?.documents || [];
        return [
          ev("Full name", profile?.fullName),
          ev("Buyer type", profile?.buyerType),
          ev("Nationality", profile?.nationality),
          ...(docs.length
            ? docs.map((d, i) => ev(d.type || d.name || `Document ${i + 1}`, d.name || "Uploaded", d.url))
            : [ev("Uploaded identity document", "None uploaded")]),
        ];
      }
      if (field === "address") return [ev("Address", profile?.address)];
      if (field === "pan") return [ev("PAN", profile?.pan), ev("Full name", profile?.fullName)];
      return [];

    default:
      return [];
  }
}

/** True when the user has supplied something an admin could actually check. */
export function hasEvidence(role, field, profile, user) {
  return evidenceFor(role, field, profile, user).some(
    (e) => e.url || (e.value && e.value !== "None uploaded")
  );
}