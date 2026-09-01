import mongoose from "mongoose";

const buyerPreferenceSchema = new mongoose.Schema(
  {
    propertyTypes: { type: [String], default: [] },
    budgetRange: {
      min: { type: Number, min: 0, default: 0 },
      max: { type: Number, min: 0, default: 0 },
    },
    locations: { type: [String], default: [] },
    preferredState: { type: String, default: "" },
    preferredCity: { type: String, default: "" },
    possessionTimeline: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const buyerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // STEP 1 - Personal
    fullName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    avatar: { type: String, default: "" },
    about: { type: String, trim: true, default: "" },

    // STEP 2 - Profile
    buyerType: {
      type: String,
      enum: ["Individual", "Family", "Developer", "Investor", "NRI", "Other", ""],
      default: "",
    },
    nationality: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    pan: { type: String, trim: true, uppercase: true, default: "" },

    // Verification (identity/address). Never faked.
    verification: {
      identity: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      address: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      pan: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
    },

    // STEP 3 - Preferences
    preferences: { type: buyerPreferenceSchema, default: () => ({}) },

    documents: {
      type: [{ name: String, url: String, type: String }],
      default: [],
    },

    onboardingComplete: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

buyerProfileSchema.index({ userId: 1 });

export default mongoose.models.BuyerProfile ||
  mongoose.model("BuyerProfile", buyerProfileSchema);
