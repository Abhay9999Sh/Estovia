import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Proposal from "@/lib/models/Proposal";
import LandListing from "@/lib/models/LandListing";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";

const PROPOSAL_TYPES = ["Land Purchase", "Joint Development", "Development Agreement", "Lease", "Other"];

/**
 * POST /api/proposals/[id]/counter
 * Appends a new immutable version (counter-offer) to the proposal history.
 * The active version is never overwritten - a new one is created instead.
 */
export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Proposal not found.", 400);

  const body = await request.json();
  await connectDB();

  const proposal = await Proposal.findById(id);
  if (!proposal) return fail("Proposal not found.", 404);

  const isBuilder = String(proposal.builderId) === String(user._id);
  const isLandowner = String(proposal.landownerId) === String(user._id);
  if (!isBuilder && !isLandowner) {
    return fail("You are not authorized to perform this action.", 403);
  }

  // Only allowed while the proposal is still being negotiated
  if (!["submitted", "under_review", "countered"].includes(proposal.status)) {
    return fail("This proposal is no longer open to counter offers.", 400);
  }

  const authorRole = isBuilder ? "builder" : "landowner";

  const version = {
    version: (proposal.history.length || 0) + 1,
    createdBy: user._id,
    authorRole,
    proposalType: PROPOSAL_TYPES.includes(body.proposalType)
      ? body.proposalType
      : proposal.history[proposal.activeIndex]?.proposalType || "Land Purchase",
    offeredAmount: Math.max(0, Number(body.offeredAmount) || 0),
    amountCurrency: "INR",
    revenueShare:
      body.revenueShare != null && body.revenueShare !== ""
        ? Math.min(100, Math.max(0, Number(body.revenueShare)))
        : null,
    developmentShare:
      body.developmentShare != null && body.developmentShare !== ""
        ? Math.min(100, Math.max(0, Number(body.developmentShare)))
        : null,
    expectedDuration: sanitizeText(body.expectedDuration, 200),
    expectedDurationMonths:
      body.expectedDurationMonths != null
        ? Math.max(0, Number(body.expectedDurationMonths) || 0)
        : null,
    paymentStructure: sanitizeText(body.paymentStructure, 1000),
    investmentEstimate: Math.max(0, Number(body.investmentEstimate) || 0),
    terms: sanitizeText(body.terms, 5000),
    notes: sanitizeText(body.notes, 2000),
    status: "submitted",
    responseNote: sanitizeText(body.responseNote, 1000),
    viewedByOther: false,
    createdAt: new Date(),
  };

  proposal.history.push(version);
  proposal.activeIndex = proposal.history.length - 1;
  proposal.status = "countered";
  proposal.viewedByOther = false;
  await proposal.save();

  const listing = await LandListing.findById(proposal.landId);
  const otherId = isBuilder ? proposal.landownerId : proposal.builderId;

  await createNotification({
    userId: otherId,
    type: "counter_offer",
    title: "Counter offer",
    message: `${user.name} sent a counter offer on the proposal for "${listing?.title || "your land"}".`,
    entityType: "proposal",
    entityId: proposal._id,
    link: isBuilder ? "/landowner/proposals" : "/builder/proposals",
    metadata: { proposalId: proposal._id, landId: proposal.landId, version: version.version },
  });

  audit({
    actor: user._id,
    entity: "proposal",
    entityId: proposal._id,
    action: "proposal_countered",
    metadata: { version: version.version, authorRole },
  });

  return ok({ proposal, message: "Counter offer submitted." });
});
