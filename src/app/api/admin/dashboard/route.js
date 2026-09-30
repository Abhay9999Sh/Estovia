import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import User from "@/lib/models/User";
import LandListing from "@/lib/models/LandListing";
import Project from "@/lib/models/Project";
import Order from "@/lib/models/Order";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import Quotation from "@/lib/models/Quotation";
import BuyerApplication from "@/lib/models/BuyerApplication";
import Report from "@/lib/models/Report";
import AuditLog from "@/lib/models/AuditLog";
import BuilderProfile from "@/lib/models/BuilderProfile";
import SupplierProfile from "@/lib/models/SupplierProfile";
import BuyerProfile from "@/lib/models/BuyerProfile";
import LandownerProfile from "@/lib/models/LandownerProfile";
import {
  VERIFIED_ROLES,
  REVIEWABLE_STATUSES,
  fieldsForRole,
  ownerOfField,
  fieldPath,
  overallRankExpr,
} from "@/lib/verification";

const ROLE_MODELS = {
  builder: BuilderProfile,
  supplier: SupplierProfile,
  buyer: BuyerProfile,
  landowner: LandownerProfile,
};

/** `overallRankExpr` rank -> the state `deriveOverall` would return. */
const RANK_TO_STATE = {
  0: "rejected",
  1: "under_review",
  2: "partial",
  3: "pending",
  4: "verified",
};

const OVERALL_STATES = Object.values(RANK_TO_STATE);

/**
 * Per-role overall verification counts, computed in the database.
 *
 * The previous version called `Model.find().lean()` and `User.find().lean()`
 * for all four roles - eight full collection scans, every dashboard load - and
 * then derived the state in JavaScript. This joins the user once, ranks each
 * profile with the same `overallRankExpr` the list routes sort by, and groups.
 */
async function verificationBreakdown() {
  const out = {};
  let needsInfo = 0;
  let pendingFields = 0;

  await Promise.all(
    VERIFIED_ROLES.map(async (role) => {
      const Model = ROLE_MODELS[role];
      const profileFields = fieldsForRole(role).filter((f) => ownerOfField(role, f) === "profile");
      const userFields = fieldsForRole(role).filter((f) => ownerOfField(role, f) === "user");

      const [ranked, totalProfiles, profileNeedsReview, profileNeedsInfo, userNeedsReview, userNeedsInfo] =
        await Promise.all([
          Model.aggregate([
            { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "__u" } },
            // Unwrap the joined owner. Query predicates match "any array
            // element", but `overallRankExpr` compares the whole array, so the
            // user-owned paths would be unreachable without this step.
            { $addFields: { __u: { $first: "$__u" } } },
            { $addFields: { __rank: overallRankExpr(role, "__u") } },
            { $group: { _id: "$__rank", count: { $sum: 1 } } },
          ]),
          Model.countDocuments(),
          profileFields.length
            ? Model.countDocuments({
                $or: profileFields.map((f) => ({ [fieldPath(role, f)]: { $in: REVIEWABLE_STATUSES } })),
              })
            : 0,
          profileFields.length
            ? Model.countDocuments({
                $or: profileFields.map((f) => ({
                  [fieldPath(role, f)]: { $in: ["needs_information", "rejected"] },
                })),
              })
            : 0,
          userFields.length
            ? User.countDocuments({
                $or: userFields.map((f) => ({ [`verification.${f}`]: { $in: REVIEWABLE_STATUSES } })),
              })
            : 0,
          userFields.length
            ? User.countDocuments({
                $or: userFields.map((f) => ({
                  [`verification.${f}`]: { $in: ["needs_information", "rejected"] },
                })),
              })
            : 0,
        ]);

      const counts = Object.fromEntries(OVERALL_STATES.map((s) => [s, 0]));
      for (const r of ranked) {
        const state = RANK_TO_STATE[r._id];
        if (state) counts[state] = r.count;
      }
      counts.total = totalProfiles;

      out[role] = counts;
      pendingFields += profileNeedsReview + userNeedsReview;
      needsInfo += profileNeedsInfo + userNeedsInfo;
    })
  );

  return { verificationByRole: out, needsInfo, pendingFields };
}

export const GET = withErrorHandling(async () => {
  const adminUser = await requireAdmin();
  await connectDB();

  const [
    userCount,
    landCount,
    projectCount,
    orderCount,
    requirementCount,
    quotationCount,
    applicationCount,
    reportCount,
    pendingLands,
    pendingProjects,
    openReports,
    pendingLandDocs,
    pendingProjectDocs,
    recentLogs,
    recentSignups,
    recentListings,
    recentOrders,
  ] = await Promise.all([
    User.countDocuments(),
    LandListing.countDocuments(),
    Project.countDocuments(),
    Order.countDocuments(),
    SupplierRequirement.countDocuments(),
    Quotation.countDocuments(),
    BuyerApplication.countDocuments(),
    Report.countDocuments(),
    LandListing.countDocuments({
      $or: [{ verificationStatus: "submitted" }, { verificationStatus: "under_review" }],
    }),
    Project.countDocuments({ status: { $in: ["Planning", "Land Acquisition", "Documentation", "Approvals"] } }),
    Report.countDocuments({ status: { $in: ["OPEN", "UNDER_REVIEW", "WAITING_FOR_INFORMATION"] } }),
    import("@/lib/models/LandDocument").then(({ default: M }) =>
      M.countDocuments({ status: { $in: ["pending", "submitted"] } })
    ),
    import("@/lib/models/ProjectDocument").then(({ default: M }) =>
      M.countDocuments({ status: { $in: ["uploaded", "under_review"] } })
    ),
    AuditLog.find().sort({ createdAt: -1 }).limit(15).lean(),
    User.find().sort({ createdAt: -1 }).limit(10).select("name username email roles createdAt verification").lean(),
    LandListing.find().sort({ createdAt: -1 }).limit(10).select("title pricing verificationStatus status location reviewedBy reviewedAt createdAt").lean(),
    Order.find().sort({ createdAt: -1 }).limit(10).select("orderNumber totalAmount status payment.amount createdAt").lean(),
  ]);

  const [usersByRole, landsByStatus, ordersByStatus, projectsByStatus, requirementsByStatus] =
    await Promise.all([
      User.aggregate([{ $group: { _id: "$roles", count: { $sum: 1 } } }]),
      LandListing.aggregate([{ $group: { _id: "$verificationStatus", count: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Project.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      SupplierRequirement.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

  const { verificationByRole, needsInfo, pendingFields } = await verificationBreakdown();

  // Total verifiable profiles, i.e. every role profile that can be reviewed.
  const verifiableProfiles = Object.values(verificationByRole).reduce(
    (sum, c) => sum + (c.total || 0),
    0
  );

  // 14-day admin verification activity series (from audit logs)
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);
  const verificationLogs = await AuditLog.find({
    action: /^verification_/,
    createdAt: { $gte: since },
  })
    .select("createdAt action")
    .lean();
  const dayKeys = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const perDay = new Map(dayKeys.map((k) => [k, 0]));
  const actionCounts = {};
  for (const l of verificationLogs) {
    const k = l.createdAt.toISOString().slice(0, 10);
    if (perDay.has(k)) perDay.set(k, perDay.get(k) + 1);
    const a = l.action.slice("verification_".length);
    actionCounts[a] = (actionCounts[a] || 0) + 1;
  }
  const verificationActivity = dayKeys.map((k) => ({ date: k, count: perDay.get(k) }));
  const verificationActions = Object.entries(actionCounts).map(([action, count]) => ({ action, count }));

  return ok({
    stats: {
      users: userCount,
      lands: landCount,
      projects: projectCount,
      orders: orderCount,
      requirements: requirementCount,
      quotations: quotationCount,
      applications: applicationCount,
      reports: reportCount,
      // Every role profile that participates in profile verification. The old
      // value counted the legacy `Verification` collection, which nothing
      // writes to, so it was always 0 and the tile was misleading.
      verifications: verifiableProfiles,
      // Verification *fields* waiting on an admin decision, counted per field so
      // the number matches the review queue exactly.
      pendingVerifications: pendingFields,
      needsInfo,
      pendingLands,
      pendingProjects,
      openReports,
      pendingDocuments: pendingLandDocs + pendingProjectDocs,
    },
    breakdown: {
      usersByRole,
      landsByStatus,
      ordersByStatus,
      projectsByStatus,
      requirementsByStatus,
      verificationByRole,
      verificationActions,
    },
    activity: {
      verification: verificationActivity,
    },
    recent: {
      logs: recentLogs,
      signups: recentSignups,
      listings: recentListings,
      orders: recentOrders,
    },
    generatedBy: String(adminUser._id),
  });
});