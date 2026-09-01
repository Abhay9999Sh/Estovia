import mongoose from "mongoose";

/**
 * Reports & disputes. Users can report content (a listing, a project, an
 * order, another user) and these are triaged by admins. The full status
 * history is preserved immutably so nothing is ever silently overwritten.
 */
const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subjectType: {
      type: String,
      enum: ["land", "project", "order", "application", "user", "other"],
      default: "other",
    },
    subjectId: { type: String, default: "" },
    category: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    documents: { type: [String], default: [] },

    status: {
      type: String,
      enum: ["OPEN", "UNDER_REVIEW", "WAITING_FOR_INFORMATION", "RESOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    resolutionNote: { type: String, trim: true, default: "" },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    history: {
      type: [
        {
          status: { type: String, enum: ["OPEN", "UNDER_REVIEW", "WAITING_FOR_INFORMATION", "RESOLVED", "CLOSED"] },
          note: { type: String, trim: true, default: "" },
          by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          byRole: { type: String, enum: ["user", "admin"], default: "user" },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Report ||
  mongoose.model("Report", reportSchema);