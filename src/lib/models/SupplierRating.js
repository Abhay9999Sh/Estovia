import mongoose from "mongoose";

const supplierRatingSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    supplierProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProfile",
      required: true,
      index: true,
    },
    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    overallRating: { type: Number, min: 1, max: 5, required: true },
    criteria: {
      quality: { type: Number, min: 1, max: 5, default: null },
      pricing: { type: Number, min: 1, max: 5, default: null },
      delivery: { type: Number, min: 1, max: 5, default: null },
      communication: { type: Number, min: 1, max: 5, default: null },
    },
    review: { type: String, trim: true, default: "" },
    verified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

supplierRatingSchema.index({ supplierProfileId: 1 });
supplierRatingSchema.index({ orderId: 1 }, { sparse: true });

export default mongoose.models.SupplierRating ||
  mongoose.model("SupplierRating", supplierRatingSchema);
