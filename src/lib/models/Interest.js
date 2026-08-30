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
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
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
interestSchema.index({ interestedUserRef: 1, landId: 1 }, { unique: true });

export default mongoose.models.Interest ||
  mongoose.model("Interest", interestSchema);
