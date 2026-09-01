import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import mongoose from "mongoose";
import LandDocument from "@/lib/models/LandDocument";
import ProjectDocument from "@/lib/models/ProjectDocument";
import BuyerApplication from "@/lib/models/BuyerApplication";
import LandownerProfile from "@/lib/models/LandownerProfile";

const ALLOWED = ["verified", "rejected", "under_review"];

export const PATCH = withErrorHandling(async (request, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const kind = (request.nextUrl.searchParams.get("kind") || "land").trim();
  if (!mongoose.isValidObjectId(id)) return fail("Invalid item.", 400);

  const body = await request.json();
  const status = sanitizeText(body.status, 40);
  const note = sanitizeText(body.note, 1000);

  if (!ALLOWED.includes(status)) return fail("Invalid status.", 400);
  if (status === "rejected" && !note) return fail("A reason is required when rejecting.", 400);

  await connectDB();

  let ownerId = null;
  let prev = null;
  let entityLabel = kind;

  if (kind === "land") {
    const doc = await LandDocument.findById(id);
    if (!doc) return fail("Document not found.", 404);
    ownerId = doc.ownerId;
    prev = doc.status;
    doc.status = status;
    doc.reviewNotes = note;
    doc.reviewedBy = admin._id;
    doc.reviewedAt = new Date();
    await doc.save();
  } else if (kind === "project") {
    const doc = await ProjectDocument.findById(id);
    if (!doc) return fail("Document not found.", 404);
    ownerId = doc.builderId;
    prev = doc.status;
    doc.status = status;
    doc.reviewNotes = note;
    doc.reviewedBy = admin._id;
    doc.reviewedAt = new Date();
    await doc.save();
  } else if (kind === "application") {
    const docIndex = parseInt(body.docIndex, 10);
    if (Number.isNaN(docIndex)) return fail("A document index is required for applications.", 400);
    const app = await BuyerApplication.findById(id);
    if (!app) return fail("Application not found.", 404);
    if (!app.documents || !app.documents[docIndex]) return fail("Document index out of range.", 400);
    ownerId = app.buyerId;
    prev = app.documents[docIndex].status;
    app.documents[docIndex].status = status;
    app.documents[docIndex].reviewNotes = note;
    app.documents[docIndex].reviewedBy = admin._id;
    app.documents[docIndex].reviewedAt = new Date();
    app.markModified("documents");
    await app.save();
  } else if (kind === "landowner_identity") {
    const profile = await LandownerProfile.findOne({ userId: id });
    if (!profile || !profile.identityDocument) return fail("Profile or document not found.", 404);
    ownerId = id;
    prev = profile.identityDocument.status;
    profile.identityDocument.status = status;
    profile.identityDocument.reviewNotes = note;
    profile.identityDocument.reviewedBy = admin._id;
    profile.identityDocument.reviewedAt = new Date();
    profile.reviewedBy = admin._id;
    profile.reviewedAt = new Date();
    await profile.save();
    entityLabel = "landowner_identity";
  } else {
    return fail("Invalid document kind.", 400);
  }

  audit({
    actor: admin._id,
    actorRole: "admin",
    entity: `document_${entityLabel}`,
    entityId: String(id),
    action: `document_${status}`,
    previousStatus: prev,
    newStatus: status,
    reason: note,
  });

  if (ownerId) {
    await createNotification({
      userId: String(ownerId),
      type: "verification_updated",
      title: status === "verified" ? "Document approved" : status === "rejected" ? "Document rejected" : "Document under review",
      message: status === "rejected" ? `Your document was rejected. ${note ? "Reason: " + note : ""}` : `Your document has been ${status}.`,
      link: "/account",
    });
  }

  return ok({ message: `Document marked ${status}.` });
});