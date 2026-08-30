import mongoose from "mongoose";

const landDocumentSchema = new mongoose.Schema(
  {
    landId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LandListing",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "sale_deed",
        "mutation",
        "land_record",
        "encumbrance",
        "tax_receipt",
        "survey_map",
        "other",
      ],
      required: true,
    },
    label: { type: String, default: "" },
    filename: { type: String, default: "" },
    url: { type: String, default: "" },
    mediaType: {
      type: String,
      enum: ["document", "image", "video"],
      default: "document",
    },
    acceptedFormats: { type: String, default: "" },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "submitted", "verified", "rejected"],
    },
    reviewNotes: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

landDocumentSchema.index({ landId: 1, type: 1 });
landDocumentSchema.index({ status: 1 });

export default mongoose.models.LandDocument ||
  mongoose.model("LandDocument", landDocumentSchema);
