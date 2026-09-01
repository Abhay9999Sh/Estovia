import mongoose from "mongoose";

const proposalVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorRole: { type: String, enum: ["builder", "landowner"], default: "builder" },
    proposalType: {
      type: String,
      enum: ["Land Purchase", "Joint Development", "Development Agreement", "Lease", "Other"],
      default: "Land Purchase",
    },

    offeredAmount: { type: Number, min: 0, default: 0 },
    amountCurrency: { type: String, default: "INR" },
    revenueShare: { type: Number, min: 0, max: 100, default: null },
    developmentShare: { type: Number, min: 0, max: 100, default: null },
    expectedDuration: { type: String, trim: true, default: "" },
    expectedDurationMonths: { type: Number, min: 0, default: null },
    paymentStructure: { type: String, trim: true, default: "" },
    investmentEstimate: { type: Number, min: 0, default: 0 },
    terms: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    // The action taken on this specific version
    status: {
      type: String,
      enum: ["submitted", "countered", "accepted", "rejected"],
      default: "submitted",
    },
    responseNote: { type: String, trim: true, default: "" },

    viewedByOther: { type: Boolean, default: false },
    createdAt: { type: Date, default: null },
  },
  { _id: false }
);

const proposalSchema = new mongoose.Schema(
  {
    landId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LandListing",
      required: true,
      index: true,
    },
    landownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    interestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interest",
      default: null,
    },

    // Overall workflow status of the proposal (not the per-version status)
    status: {
      type: String,
      enum: ["draft", "submitted", "under_review", "countered", "accepted", "rejected", "withdrawn", "expired"],
      default: "draft",
    },

    // Immutable history of proposal versions. Never mutated in place - a
    // new version is appended for every counter.
    history: { type: [proposalVersionSchema], default: [] },

    viewedByLandowner: { type: Boolean, default: false },
    viewedByBuilder: { type: Boolean, default: false },

    activeIndex: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

proposalSchema.index({ builderId: 1, status: 1 });
proposalSchema.index({ landownerId: 1, status: 1 });
proposalSchema.index({ landId: 1 });

export default mongoose.models.Proposal ||
  mongoose.model("Proposal", proposalSchema);
