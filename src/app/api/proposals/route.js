import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Proposal from "@/lib/models/Proposal";
import Interest from "@/lib/models/Interest";
import LandListing from "@/lib/models/LandListing";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";

const PROPOSAL_TYPES = ["Land Purchase", "Joint Development", "Development Agreement", "Lease", "Other"];

function normalizeVersion(body, authorRole, userId) {
  return {
    version: 1,
    createdBy: userId,
    authorRole,
    proposalType: PROPOSAL_TYPES.includes(body.proposalType)
      ? body.proposalType
      : "Land Purchase",
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
    responseNote: "",
    viewedByOther: false,
    createdAt: new Date(),
  };
}

/**
 * POST /api/proposals  - create a proposal (builder -> landowner)
 * GET /api/proposals   - list proposals for the current user (as builder or landowner)
 */
export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  const landId = body.landId;

  if (!mongoose.isValidObjectId(landId)) return fail("Invalid land listing.", 400);

  await connectDB();

  const listing = await LandListing.findById(landId);
  if (!listing) return fail("Listing not found.", 404);

  // A proposal must be tied to a relationship: the builder must have an
  // ACCEPTED interest on this land, and cannot propose on their own land.
  if (String(listing.ownerId) === String(user._id)) {
    return fail("You cannot create a proposal on your own listing.", 400);
  }

  const interest = await Interest.findOne({
    landId,
    interestedUserRef: user._id,
    status: "accepted",
  });
  if (!interest) {
    return fail(
      "A proposal can only be created after the landowner accepts your interest.",
      403
    );
  }

  const existing = await Proposal.findOne({
    landId,
    builderId: user._id,
    status: { $nin: ["rejected", "withdrawn", "expired"] },
  });
  if (existing) {
    return fail(
      "You already have an active proposal for this land. Use counters to negotiate.",
      409
    );
  }

  const version = normalizeVersion(body, "builder", user._id);
  if (!(version.offeredAmount > 0) && !(version.revenueShare != null)) {
    return fail("Please provide an offered amount or a revenue share.", 400);
  }

  const proposal = await Proposal.create({
    landId,
    landownerId: listing.ownerId,
    builderId: user._id,
    interestId: interest._id,
    status: "submitted",
    history: [version],
    activeIndex: 0,
  });

  await createNotification({
    userId: proposal.landownerId,
    type: "proposal_received",
    title: "New proposal received",
    message: `${user.name} sent a proposal for "${listing.title}".`,
    entityType: "proposal",
    entityId: proposal._id,
    link: "/landowner/proposals",
    metadata: { proposalId: proposal._id, landId },
  });

  audit({
    actor: user._id,
    entity: "proposal",
    entityId: proposal._id,
    action: "proposal_created",
    metadata: { landId, landownerId: listing.ownerId, version: 1 },
  });

  return ok(
    { proposal, message: "Proposal submitted to the landowner." },
    201
  );
});

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope") || "mine";
  const statusFilter = searchParams.get("status") || "";

  await connectDB();

  const baseScope = scope === "landowner" ? { landownerId: user._id } : { builderId: user._id };
  const filter = { ...baseScope };
  if (statusFilter) filter.status = statusFilter;

  const proposals = await Proposal.find(filter)
    .sort({ updatedAt: -1 })
    .populate("landId", "title location pricing area verificationStatus status images")
    .populate("builderId", "name avatar username")
    .populate("landownerId", "name avatar username")
    .populate("interestId", "purpose budget timeline message")
    .lean();

  // Build marker view for the other party on each proposal
  const hydrated = proposals.map((p) => {
    const active = p.history[p.activeIndex] || p.history[0] || {};
    return {
      ...p,
      activeVersion: active,
      counterpart:
        scope === "landowner"
          ? { name: p.builderId?.name, avatar: p.builderId?.avatar, username: p.builderId?.username }
          : { name: p.landownerId?.name, avatar: p.landownerId?.avatar, username: p.landownerId?.username },
    };
  });

  return ok({ proposals: hydrated });
});
