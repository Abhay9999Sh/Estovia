import mongoose from "mongoose";

const interestSchema = new mongoose.Schema(
  {
    landId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LandListing",
      required: true,
      index: true,
    },
    interestedUserRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["buyer", "builder"],
      default: "buyer",
    },
    message: { type: String, default: "", maxlength: 1000 },

    // Builder-specific fields (populated when type === "builder")
    purpose: {
      type: String,
      enum: ["Development", "Acquisition", "Joint Development", "Other", ""],
      default: "",
    },
    budget: { type: Number, min: 0, default: null },
    timeline: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "withdrawn"],
      default: "pending",
    },
    withdrawnAt: { type: Date, default: null },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    viewedByOwner: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

interestSchema.index({ landId: 1, status: 1 });
interestSchema.index({ ownerId: 1, status: 1 });
interestSchema.index({ interestedUserRef: 1, landId: 1, status: 1 });

export default mongoose.models.Interest ||
  mongoose.model("Interest", interestSchema);
