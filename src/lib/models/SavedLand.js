import mongoose from "mongoose";

const savedLandSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    landId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LandListing",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

savedLandSchema.index({ userId: 1, landId: 1 }, { unique: true });

export default mongoose.models.SavedLand ||
  mongoose.model("SavedLand", savedLandSchema);
