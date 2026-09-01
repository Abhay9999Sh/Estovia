import mongoose from "mongoose";

const projectDocumentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["company", "identity", "gst", "mca", "rera", "project", "land", "legal", "other"],
      default: "project",
    },
    type: { type: String, trim: true, default: "" },
    label: { type: String, trim: true, default: "" },
    filename: { type: String, trim: true, default: "" },
    url: { type: String, default: "" },
    mediaType: {
      type: String,
      enum: ["document", "image", "video"],
      default: "document",
    },
    status: {
      type: String,
      enum: ["uploaded", "under_review", "verified", "rejected"],
      default: "uploaded",
    },
    reviewNotes: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

projectDocumentSchema.index({ projectId: 1, category: 1 });

export default mongoose.models.ProjectDocument ||
  mongoose.model("ProjectDocument", projectDocumentSchema);
