import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SavedLand from "@/lib/models/SavedLand";
import Interest from "@/lib/models/Interest";
import Proposal from "@/lib/models/Proposal";
import Project from "@/lib/models/Project";
import MaterialRequirement from "@/lib/models/MaterialRequirement";
import Notification from "@/lib/models/Notification";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

/**
 * GET /api/builder/dashboard
 * Real MongoDB-derived metrics for the builder dashboard and analytics.
 * Nothing is hardcoded - empty results are expressed as zero / empty lists.
 */
export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const [
    savedCount,
    interests,
    proposals,
    projects,
    materialCount,
    unreadNotifications,
  ] = await Promise.all([
    SavedLand.countDocuments({ userId: user._id }),
    Interest.find({ interestedUserRef: user._id }).lean(),
    Proposal.find({ builderId: user._id }).lean(),
    Project.countDocuments({ builderId: user._id }),
    MaterialRequirement.aggregate([
      { $match: { builderId: user._id } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),
    Notification.countDocuments({ userId: user._id, read: false }),
  ]);

  const interestMap = {
    total: interests.length,
    pending: interests.filter((i) => i.status === "pending").length,
    accepted: interests.filter((i) => i.status === "accepted").length,
    rejected: interests.filter((i) => i.status === "rejected").length,
    withdrawn: interests.filter((i) => i.status === "withdrawn").length,
  };

  const proposalMap = {
    total: proposals.length,
    active: proposals.filter((p) =>
      ["submitted", "under_review", "countered"].includes(p.status)
    ).length,
    accepted: proposals.filter((p) => p.status === "accepted").length,
    rejected: proposals.filter((p) => p.status === "rejected").length,
    withdrawn: proposals.filter((p) => p.status === "withdrawn").length,
    conversion: proposals.length ? Math.round((proposals.filter((p) => p.status === "accepted").length / proposals.length) * 100) : 0,
  };

  const projectMap = {
    total: projects,
    active: await Project.countDocuments({
      builderId: user._id,
      status: { $nin: ["Completed", "Cancelled"] },
    }),
    completed: await Project.countDocuments({ builderId: user._id, status: "Completed" }),
  };

  // Build a real, unified activity timeline from interests, proposals and
  // projects - all derived from actual records.
  const proposalsForActivity = await Proposal.find({ builderId: user._id })
    .select("status updatedAt createdAt")
    .lean();

  const activity = [
    ...interests.map((i) => ({
      id: `interest-${i._id}`,
      time: i.updatedAt || i.createdAt,
      title: interestLabel(i),
      status: i.status,
      link: "/builder/interests",
    })),
    ...proposalsForActivity.map((p) => ({
      id: `proposal-${p._id}`,
      time: p.updatedAt || p.createdAt,
      title: proposalLabel(p.status),
      status: p.status,
      link: "/builder/proposals",
    })),
    ...(await Project.find({ builderId: user._id })
      .select("name status updatedAt createdAt")
      .lean()
      .then((list) =>
        list.map((pr) => ({
          id: `project-${pr._id}`,
          time: pr.updatedAt || pr.createdAt,
          title: `Project "${pr.name}" is ${pr.status.toLowerCase()}`,
          status: pr.status,
          link: `/builder/projects/${pr._id}`,
        }))
      )),
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  return ok({
    stats: {
      savedLand: savedCount,
      interests: interestMap,
      proposals: proposalMap,
      projects: projectMap,
      materialRequirements: materialCount[0]?.count || 0,
      unreadNotifications,
      landViews: 0,
    },
    activity: activity.slice(0, 10),
    hasActivity:
      savedCount > 0 ||
      interests.length > 0 ||
      proposals.length > 0 ||
      projectMap.total > 0,
  });
});

function proposalLabel(status) {
  switch (status) {
    case "accepted":
      return "A proposal you submitted was accepted";
    case "rejected":
      return "A proposal you submitted was declined";
    case "withdrawn":
      return "You withdrew a proposal";
    case "countered":
      return "A proposal you submitted received a counter offer";
    default:
      return "You submitted a proposal";
  }
}

function interestLabel(i) {
  switch (i.status) {
    case "accepted":
      return "An interest of yours was accepted";
    case "rejected":
      return "An interest of yours was declined";
    case "withdrawn":
      return "You withdrew an interest";
    default:
      return "You expressed interest in a land listing";
  }
}
