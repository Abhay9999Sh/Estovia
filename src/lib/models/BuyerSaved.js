import mongoose from "mongoose";

/**
 * A buyer's saved item (project / unit / land listing) for later review or
 * comparison.
 */
const buyerSavedSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ["project", "unit", "land"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityRef",
    },
    entityRef: {
      type: String,
      enum: ["Project", "ProjectUnit", "LandListing"],
      default: "Project",
    },
    note: { type: String, trim: true, default: "" },
    forCompare: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

buyerSavedSchema.index({ buyerId: 1, entityType: 1, entityId: 1 }, { unique: true });

export default mongoose.models.BuyerSaved ||
  mongoose.model("BuyerSaved", buyerSavedSchema);
