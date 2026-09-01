import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Proposal from "@/lib/models/Proposal";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";

function canAccess(p, user) {
  return (
    String(p.builderId) === String(user._id) ||
    String(p.landownerId) === String(user._id)
  );
}

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Proposal not found.", 404);

  await connectDB();
  const proposal = await Proposal.findById(id)
    .populate("landId", "title location pricing area verificationStatus status images")
    .populate("builderId", "name avatar username")
    .populate("landownerId", "name avatar username")
    .populate("interestId", "purpose budget timeline message")
    .lean();

  if (!proposal) return fail("Proposal not found.", 404);
  if (!canAccess(proposal, user)) {
    return fail("You are not authorized to view this proposal.", 403);
  }

  const isLandowner = String(proposal.landownerId._id) === String(user._id);
  const isBuilder = String(proposal.builderId._id) === String(user._id);

  const hydrated = {
    ...proposal,
    activeVersion: proposal.history[proposal.activeIndex] || proposal.history[0] || {},
    history: proposal.history,
    myRole: isLandowner ? "landowner" : isBuilder ? "builder" : "viewer",
  };

  return ok({ proposal: hydrated });
});

export const PATCH = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  const body = await request.json();
  const { action } = body || {};
  if (!mongoose.isValidObjectId(id)) return fail("Proposal not found.", 400);

  await connectDB();
  const proposal = await Proposal.findById(id);
  if (!proposal) return fail("Proposal not found.", 404);
  if (!canAccess(proposal, user)) return fail("Unauthorized", 403);

  if (action === "mark_viewed") {
    const { role } = body;
    if (role === "landowner" && !proposal.viewedByLandowner) {
      proposal.viewedByLandowner = true;
    }
    if (role === "builder" && !proposal.viewedByBuilder) {
      proposal.viewedByBuilder = true;
    }
    const active = proposal.history[proposal.activeIndex];
    if (active && active.viewedByOther === false) {
      active.viewedByOther = true;
    }
    await proposal.save();
    return ok({ message: "ok" });
  }

  return fail("Invalid action.", 400);
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  const body = await request.json();
  const { action } = body;

  if (!mongoose.isValidObjectId(id)) return fail("Invalid proposal.", 400);

  await connectDB();
  const proposal = await Proposal.findById(id);
  if (!proposal) return fail("Proposal not found.", 404);
  if (!canAccess(proposal, user)) {
    return fail("You are not authorized to perform this action.", 403);
  }

  const isLandowner = String(proposal.landownerId) === String(user._id);

  if (action === "withdraw") {
    if (isLandowner) return fail("Only the builder can withdraw this proposal.", 403);
    if (proposal.status !== "submitted" && proposal.status !== "under_review") {
      return fail("This proposal cannot be withdrawn.", 400);
    }
    proposal.status = "withdrawn";
    await proposal.save();
    await createNotification({
      userId: proposal.landownerId,
      type: "interest_withdrawn",
      title: "Proposal withdrawn",
      message: "The builder withdrew their proposal.",
      entityType: "proposal",
      entityId: proposal._id,
      link: "/landowner/proposals",
      metadata: { proposalId: proposal._id, landId: proposal.landId },
    });
    audit({ actor: user._id, entity: "proposal", entityId: proposal._id, action: "proposal_withdrawn" });
    return ok({ proposal, message: "Proposal withdrawn." });
  }

  // Accept / reject current version - landowner accepts, or builder accepts a counter.
  if (action === "accept") {
    proposal.status = "accepted";
    const active = proposal.history[proposal.activeIndex];
    if (active) active.status = "accepted";
    await proposal.save();

    const otherId = isLandowner ? proposal.builderId : proposal.landownerId;
    const verb = isLandowner ? "accepted" : "accepted your counter";
    await createNotification({
      userId: otherId,
      type: "proposal_accepted",
      title: "Proposal accepted",
      message: `The ${isLandowner ? "builder" : "landowner"} ${verb}. You can now proceed to create a project.`,
      entityType: "proposal",
      entityId: proposal._id,
      link: isLandowner ? "/builder/proposals" : "/landowner/proposals",
      metadata: { proposalId: proposal._id, landId: proposal.landId },
    });
    audit({ actor: user._id, entity: "proposal", entityId: proposal._id, action: "proposal_accepted" });
    return ok({ proposal, message: "Proposal accepted." });
  }

  if (action === "reject") {
    proposal.status = "rejected";
    const active = proposal.history[proposal.activeIndex];
    if (active) active.status = "rejected";
    await proposal.save();

    const otherId = isLandowner ? proposal.builderId : proposal.landownerId;
    await createNotification({
      userId: otherId,
      type: "proposal_rejected",
      title: "Proposal declined",
      message: `The ${isLandowner ? "builder" : "landowner"} declined the latest proposal.`,
      entityType: "proposal",
      entityId: proposal._id,
      link: isLandowner ? "/builder/proposals" : "/landowner/proposals",
      metadata: { proposalId: proposal._id, landId: proposal.landId },
    });
    audit({ actor: user._id, entity: "proposal", entityId: proposal._id, action: "proposal_rejected" });
    return ok({ proposal, message: "Proposal rejected." });
  }

  return fail("Invalid action.", 400);
});
