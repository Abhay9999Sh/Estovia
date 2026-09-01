import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import ProjectDocument from "@/lib/models/ProjectDocument";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { audit } from "@/lib/audit";

const CATEGORIES = ["company", "identity", "gst", "mca", "rera", "project", "land", "legal", "other"];

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);

  await connectDB();
  const project = await Project.findById(id);
  if (!project) return fail("Project not found.", 404);
  if (String(project.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  const documents = await ProjectDocument.find({ projectId: id }).sort({ createdAt: -1 }).lean();
  return ok({ documents });
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);

  const body = await request.json();
  const category = CATEGORIES.includes(body.category) ? body.category : "project";

  await connectDB();
  const project = await Project.findById(id);
  if (!project) return fail("Project not found.", 404);
  if (String(project.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  const docs = Array.isArray(body.documents) ? body.documents : [];
  const created = [];
  for (const d of docs) {
    const doc = await ProjectDocument.create({
      projectId: id,
      builderId: user._id,
      category,
      type: sanitizeText(d.type, 120),
      label: sanitizeText(d.label, 200),
      filename: sanitizeText(d.filename, 200),
      url: sanitizeText(d.url, 500),
      mediaType: ["document", "image", "video"].includes(d.mediaType) ? d.mediaType : "document",
      // Uploading does not mean verified
      status: "uploaded",
    });
    created.push(doc);
  }

  if (created.length) {
    audit({
      actor: user._id,
      entity: "project_document",
      entityId: created[0]._id,
      action: "document_uploaded",
      metadata: { projectId: id, count: created.length, category },
    });
  }

  return ok({ documents: created, message: "Documents uploaded." }, 201);
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  const body = await request.json();
  const docId = body.docId;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(docId)) return fail("Invalid request.", 400);

  await connectDB();
  const doc = await ProjectDocument.findById(docId);
  if (!doc) return fail("Document not found.", 404);
  if (String(doc.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  await ProjectDocument.deleteOne({ _id: docId });
  return ok({ message: "Document removed." });
});
