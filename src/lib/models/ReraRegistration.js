import mongoose from "mongoose";

const reraRegistrationSchema = new mongoose.Schema(
  {
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    state: { type: String, trim: true, default: "" },
    registrationNumber: { type: String, trim: true, uppercase: true, required: true },
    promoterName: { type: String, trim: true, default: "" },
    projectName: { type: String, trim: true, default: "" },
    projectAddress: { type: String, trim: true, default: "" },
    registrationDate: { type: Date, default: null },
    completionDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "submitted", "verified", "not_found", "mismatch", "manual_review", "inactive"],
      default: "pending",
    },
    source: { type: String, default: "" },
    verifiedAt: { type: Date, default: null },
    lastVerifiedAt: { type: Date, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

reraRegistrationSchema.index({ builderId: 1 });
reraRegistrationSchema.index({ registrationNumber: 1 });

export default mongoose.models.ReraRegistration ||
  mongoose.model("ReraRegistration", reraRegistrationSchema);
