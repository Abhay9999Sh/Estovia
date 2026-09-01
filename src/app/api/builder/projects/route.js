import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import LandListing from "@/lib/models/LandListing";
import Interest from "@/lib/models/Interest";
import Proposal from "@/lib/models/Proposal";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";

const PROJECT_TYPES = ["Residential", "Commercial", "Industrial", "Mixed Use", "Plotted Development", "Township", "Other"];
const PROJECT_STATUSES = ["Planning", "Land Acquisition", "Documentation", "Approvals", "Under Construction", "Completed", "On Hold", "Cancelled"];

/**
 * A builder may only associate a land listing with their project if they
 * have an established relationship (accepted interest) with that land.
 */
async function canAssociateLand(builderId, landId) {
  const interest = await Interest.findOne({
    landId,
    interestedUserRef: builderId,
    status: "accepted",
  });
  if (interest) return true;

  const proposal = await Proposal.findOne({
    landId,
    builderId,
    status: "accepted",
  });
  return !!proposal;
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { searchParams } = request.nextUrl;
  const statusFilter = searchParams.get("status") || "";
  await connectDB();

  const filter = { builderId: user._id };
  if (statusFilter) filter.status = statusFilter;

  const projects = await Project.find(filter)
    .sort({ createdAt: -1 })
    .populate("landId", "title location pricing area verificationStatus status images")
    .populate("landownerId", "name avatar username")
    .lean();

  return ok({ projects });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();

  const name = sanitizeText(body.name, 160);
  if (!name) return fail("Please provide a project name.", 400);

  const landId = body.landId || null;
  let landownerId = null;
  let projectLocation = {};

  if (landId) {
    if (!mongoose.isValidObjectId(landId)) return fail("Invalid land listing.", 400);
    const listing = await LandListing.findById(landId);
    if (!listing) return fail("Associated land not found.", 404);
    if (String(listing.ownerId) === String(user._id)) {
      return fail("You cannot create a project on your own land listing.", 400);
    }
    const okAssoc = await canAssociateLand(user._id, landId);
    if (!okAssoc) {
      return fail(
        "You can only associate land you have an accepted interest/proposal with.",
        403
      );
    }
    landownerId = listing.ownerId;
    projectLocation = {
      address: listing.location?.address || "",
      city: listing.location?.city || "",
      district: listing.location?.district || "",
      state: listing.location?.state || "",
      pincode: listing.location?.pincode || "",
      latitude: listing.location?.latitude ?? null,
      longitude: listing.location?.longitude ?? null,
    };
  } else if (body.location) {
    projectLocation = {
      address: sanitizeText(body.location?.address, 500),
      city: sanitizeText(body.location?.city, 80),
      district: sanitizeText(body.location?.district, 80),
      state: sanitizeText(body.location?.state, 80),
      pincode: sanitizeText(body.location?.pincode, 12),
      latitude: Number(body.location?.latitude) || null,
      longitude: Number(body.location?.longitude) || null,
    };
  }

  const project = await Project.create({
    builderId: user._id,
    name,
    description: sanitizeText(body.description, 5000),
    projectType: PROJECT_TYPES.includes(body.projectType) ? body.projectType : "Residential",
    landId: landId || null,
    landownerId,
    location: projectLocation,
    estimatedBudget: Math.max(0, Number(body.estimatedBudget) || 0),
    startDate: body.startDate ? new Date(body.startDate) : null,
    completionDate: body.completionDate ? new Date(body.completionDate) : null,
    status: PROJECT_STATUSES.includes(body.status) ? body.status : "Planning",
    rera: {
      state: sanitizeText(body.rera?.state, 80),
      registrationNumber: sanitizeText(body.rera?.registrationNumber, 40).toUpperCase(),
      promoterName: sanitizeText(body.rera?.promoterName, 160),
      projectName: sanitizeText(body.rera?.projectName, 160),
      registrationDate: body.rera?.registrationDate ? new Date(body.rera.registrationDate) : null,
      completionDate: body.rera?.completionDate ? new Date(body.rera.completionDate) : null,
      status: "pending",
    },
    images: Array.isArray(body.images) ? body.images.slice(0, 10) : [],
  });

  if (landId && landownerId) {
    await createNotification({
      userId: landownerId,
      type: "project_update",
      title: "Project association",
      message: `${user.name} created a project associated with your land "${name}".`,
      entityType: "project",
      entityId: project._id,
      link: "/landowner/projects",
      metadata: { projectId: project._id, landId },
    });
  }

  audit({
    actor: user._id,
    entity: "project",
    entityId: project._id,
    action: "project_created",
    metadata: { landId, landownerId },
  });

  return ok({ project, message: "Project created." }, 201);
});
