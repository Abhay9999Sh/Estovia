import mongoose from "mongoose";
import { verificationMetaField } from "@/lib/models/verificationItem";

const coOwnerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    ownershipPercentage: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

const landownerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    fullName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    dob: { type: Date, default: null },
    address: { type: String, trim: true, default: "" },
    avatar: { type: String, default: "" },

    // STEP 2 - Identity
    pan: { type: String, trim: true, uppercase: true, default: "" },
    identityDocument: {
      type: { type: String, default: "" },
      url: { type: String, default: "" },
      status: {
        type: String,
        default: "pending",
        enum: ["pending", "submitted", "under_review", "needs_information", "verified", "rejected"],
      },
    },

    // STEP 3 - Landowner details
    ownershipType: {
      type: String,
      enum: ["individual", "joint", "company", "trust"],
      default: "individual",
    },
    coOwners: {
      type: [coOwnerSchema],
      default: [],
    },

    onboardingComplete: { type: Boolean, default: false },

    // Per-field review trail (rejection reason, reviewer, timestamps).
    verificationMeta: verificationMetaField(),

    reviewNotes: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

landownerProfileSchema.index({ userId: 1 });
landownerProfileSchema.index({ "identityDocument.status": 1 });

export default mongoose.models.LandownerProfile ||
  mongoose.model("LandownerProfile", landownerProfileSchema);
