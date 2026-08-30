import mongoose from "mongoose";

const verificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["IDENTITY", "DOCUMENT", "LAND_OWNERSHIP", "RERA", "BUSINESS"],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    landId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LandListing",
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "submitted", "under_review", "verified", "not_found", "mismatch", "rejected", "manual_review"],
      default: "pending",
    },
    // RERA fields
    registrationNumber: { type: String, default: "" },
    reraState: { type: String, default: "" },
    projectName: { type: String, default: "" },
    promoterName: { type: String, default: "" },
    source: { type: String, default: "" },
    verifiedAt: { type: Date, default: null },

    // LAND_OWNERSHIP fields
    documents: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "LandDocument" }],
      default: [],
    },

    payload: { type: mongoose.Schema.Types.Mixed, default: {} },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

verificationSchema.index({ type: 1, status: 1 });
verificationSchema.index({ userId: 1, type: 1 });
verificationSchema.index({ landId: 1 });

export default mongoose.models.Verification ||
  mongoose.model("Verification", verificationSchema);
