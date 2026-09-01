import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import ReraRegistration from "@/lib/models/ReraRegistration";
import BuilderProfile from "@/lib/models/BuilderProfile";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { verifyReraRegistration } from "@/lib/rera";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const registrations = await ReraRegistration.find({ builderId: user._id })
    .sort({ createdAt: -1 })
    .lean();
  return ok({ registrations });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  const state = sanitizeText(body.state, 80);
  const registrationNumber = sanitizeText(body.registrationNumber, 40).toUpperCase();

  if (!state || !registrationNumber) {
    return fail("Please provide the RERA state and registration number.", 400);
  }

  await connectDB();

  const existing = await ReraRegistration.findOne({
    builderId: user._id,
    registrationNumber,
  });
  if (existing) return fail("This RERA registration already exists.", 409);

  // VERIFY: because no live RERA API is wired, this returns manual_review /
  // pending - it is never marked "verified" without an authorized source.
  const result = await verifyReraRegistration({ state, registrationNumber });

  const registration = await ReraRegistration.create({
    builderId: user._id,
    state,
    registrationNumber,
    promoterName: sanitizeText(body.promoterName, 160),
    projectName: sanitizeText(body.projectName, 160),
    projectAddress: sanitizeText(body.projectAddress, 500),
    registrationDate: body.registrationDate ? new Date(body.registrationDate) : null,
    completionDate: body.completionDate ? new Date(body.completionDate) : null,
    status: result.status,
    source: result.source,
    verifiedAt: result.verifiedAt,
    lastVerifiedAt: new Date(),
    payload: result,
  });

  // Mirror into the builder profile for badge display
  await BuilderProfile.updateOne(
    { userId: user._id },
    {
      $push: {
        reraRegistrations: {
          state,
          registrationNumber,
          promoterName: registration.promoterName,
          projectName: registration.projectName,
          status: result.status,
          verifiedAt: result.verifiedAt,
          source: result.source,
        },
      },
    }
  );

  const isVerified = result.status === "verified";
  await createNotification({
    userId: user._id,
    type: "rera_update",
    title: isVerified ? "RERA registration verified" : "RERA registration pending",
    message: isVerified
      ? `Registration ${registrationNumber} was verified.`
      : `We could not independently verify registration ${registrationNumber}. It has been queued for manual review.`,
    entityType: "rera",
    entityId: registration._id,
    link: "/builder/rera",
    metadata: { registrationNumber },
  });

  audit({
    actor: user._id,
    entity: "rera",
    entityId: registration._id,
    action: "rera_registered",
    metadata: { state, registrationNumber, status: result.status },
  });

  return ok(
    { registration, message: "RERA registration added.", status: result.status },
    201
  );
});
