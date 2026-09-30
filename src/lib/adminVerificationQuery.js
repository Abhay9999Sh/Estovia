import { parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import {
  OVERALL_STATUSES,
  fieldsForRole,
  ownerOfField,
  statusFilter,
  overallFilter,
  overallRankExpr,
} from "@/lib/verification";

/**
 * The `User` model is loaded lazily so importing this module does not pull in
 * the whole session/Next-headers chain, and so tests can inject a stand-in.
 */
async function resolveUserModel(models) {
  if (models?.User) return models.User;
  const { default: User } = await import("@/lib/models/User");
  return User;
}

/**
 * Shared query layer for the Admin role lists (builders / landowners / buyers /
 * suppliers).
 *
 * Why this exists: the "overall" verification state is *derived*, and it spans
 * two collections because `phone` lives on `User` while the rest of the fields
 * live on the role profile. It therefore cannot be filtered or sorted with a
 * plain `find()` on the profile model. The previous implementation paged in
 * Mongo first and then filtered that window in JavaScript, so `total` was a
 * count of one over-fetched window rather than the real result set: page counts
 * drifted and later pages could come back short or empty.
 *
 * Here it is resolved in one aggregation:
 *   1. `$lookup` the owner, then unwrap the array with `$first`. Query
 *      predicates match "any array element" but aggregation expressions compare
 *      the whole array, so user-owned fields are only reachable after unwrapping.
 *   2. `$match` the search / status / field filters, with the derived overall
 *      state expressed as a real predicate.
 *   3. `$facet` a `$count` next to the sorted+paged slice, so `total` and the
 *      returned page always agree.
 *
 * The joined user is dropped before returning; callers hydrate users separately
 * with an explicit allow-list so no field such as a password hash can leak into
 * a response.
 */

/** Alias the joined user document is exposed under inside the pipeline. */
export const USER_ALIAS = "u";

/** Fields always allowed through to a list response. */
const USER_FIELDS = "name username email phone accountStatus verification verificationMeta createdAt";

/** Sort keys shared by every role list. `verification` is computed separately. */
const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name: { [`${USER_ALIAS}.name`]: 1, _id: 1 },
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const andPush = (match, clause) => {
  match.$and = [...(match.$and || []), clause];
};

/**
 * Runs the shared pipeline and returns the page of profiles plus their users.
 *
 * @param {object}   options
 * @param {import("mongoose").Model} options.Model   profile model to page over
 * @param {string}   options.role       landowner | builder | supplier | buyer
 * @param {URLSearchParams} options.searchParams
 * @param {string[]} [options.profileSearch] dotted paths on the profile for `?q=`
 * @param {string[]} [options.userSearch]    paths on the user for `?q=`
 * @param {(field, stat, add) => void} [options.onFieldFilter]
 *        escape hatch for role-specific pseudo-fields, e.g. a builder's RERA
 *        registrations, which are not part of the profile verification block
 * @param {object}   [options.extraMatch]   extra profile-level match, merged with `$and`
 * @param {object}   [options.models]       model overrides, so the query can be
 *        exercised against throwaway collections in tests
 * @param {string}   [options.userCollection] collection the `$lookup` joins,
 *        overridable for the same reason as `models`
 * @param {number}   [options.defaultLimit]
 * @param {number}   [options.maxLimit]
 */
export async function queryRoleList({
  Model,
  role,
  searchParams,
  profileSearch = [],
  userSearch = [],
  onFieldFilter = null,
  extraMatch = null,
  models = {},
  userCollection = "users",
  defaultLimit = 20,
  maxLimit = 100,
}) {
  const UserModel = await resolveUserModel(models);
  const { q, status } = parseSearch(searchParams);
  const field = (searchParams.get("field") || "").trim();
  const fieldStat = (searchParams.get("fieldStat") || "").trim();
  const sortBy = (searchParams.get("sort") || "newest").trim();
  const { page, limit, skip } = parsePagination(searchParams, defaultLimit, maxLimit);

  const match = {};

  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    const branches = [
      ...profileSearch.map((p) => ({ [p]: re })),
      ...userSearch.map((p) => ({ [`${USER_ALIAS}.${p}`]: re })),
    ];
    if (branches.length) match.$or = branches;
  }

  // Suspended accounts stay hidden unless explicitly requested.
  if (status === "suspended") match[`${USER_ALIAS}.accountStatus`] = "suspended";
  else match[`${USER_ALIAS}.accountStatus`] = { $ne: "suspended" };

  if (OVERALL_STATUSES.includes(status)) {
    const f = overallFilter(role, status, USER_ALIAS);
    if (f) andPush(match, f);
  }

  if (extraMatch) andPush(match, extraMatch);

  // `?field=x&fieldStat=y` narrows to one verification item. With no
  // `fieldStat` the field is not filtered at all - the response simply reports
  // that field's status, so listing every builder by `field=pan` is useful.
  const wantsFieldStat = fieldStat && fieldStat !== "all";
  if (field && wantsFieldStat) {
    if (fieldsForRole(role).includes(field)) {
      if (ownerOfField(role, field) === "user") {
        match[`${USER_ALIAS}.verification.${field}`] = fieldStat;
      } else {
        andPush(match, statusFilter(role, field, fieldStat));
      }
    } else if (onFieldFilter) {
      onFieldFilter(field, fieldStat, (clause) => andPush(match, clause));
    }
  }

  const needsRank = sortBy === "verification";
  const sortSpec = needsRank
    ? { _overallRank: 1, createdAt: -1, _id: -1 }
    : SORTS[sortBy] || SORTS.newest;

  const pipeline = [
    { $lookup: { from: userCollection, localField: "userId", foreignField: "_id", as: USER_ALIAS } },
    { $addFields: { [USER_ALIAS]: { $first: `$${USER_ALIAS}` } } },
    // A profile with no owner cannot be reviewed, so it never belongs in a list.
    { $match: { ...match, [USER_ALIAS]: { $exists: true } } },
  ];

  if (needsRank) pipeline.push({ $addFields: { _overallRank: overallRankExpr(role, USER_ALIAS) } });

  pipeline.push(
    { $project: { companyDocuments: 0, [USER_ALIAS]: 0 } },
    {
      $facet: {
        total: [{ $count: "n" }],
        // The sort key has to survive the sort, so drop it only afterwards.
        page: [{ $sort: sortSpec }, { $skip: skip }, { $limit: limit }, { $project: { _overallRank: 0 } }],
      },
    }
  );

  const [result] = await Model.aggregate(pipeline);
  const total = result?.total?.[0]?.n || 0;
  const docs = result?.page || [];

  const users = await UserModel.find({ _id: { $in: docs.map((d) => d.userId).filter(Boolean) } })
    .select(USER_FIELDS)
    .lean();
  const usersById = new Map(users.map((u) => [String(u._id), u]));

  return { docs, usersById, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * Wraps a `queryRoleList` result in the standard list envelope. Profiles whose
 * owner could not be hydrated are skipped rather than returned half-empty.
 */
export function listResponse({ docs, usersById, total, page, limit, pageCount }, map) {
  const items = [];
  for (const doc of docs) {
    const user = usersById.get(String(doc.userId));
    if (!user) continue;
    items.push(map(doc, user));
  }
  return ok({ items, total, page, limit, pageCount });
}
