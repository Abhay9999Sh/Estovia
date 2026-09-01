import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Generic participant pair (sorted by ObjectId string) used for
    // idempotency across all conversation contexts.
    participantA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    participantB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    context: {
      type: String,
      enum: ["landowner_builder", "builder_supplier", "builder_buyer", "landowner_buyer"],
      default: "landowner_builder",
      index: true,
    },

    // Backward-compatible fields (landowner <-> builder flow)
    landId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LandListing",
      index: true,
      default: null,
    },
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    landownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    interestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interest",
      default: null,
    },
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      default: null,
    },

    // New contexts
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    supplierProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProfile",
      index: true,
      default: null,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true,
      default: null,
    },
    requirementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierRequirement",
      default: null,
    },
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      default: null,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectUnit",
      default: null,
    },
    inquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyerInquiry",
      default: null,
    },
    siteVisitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SiteVisit",
      default: null,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyerApplication",
      default: null,
    },

    lastMessageAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Preserve backward-compatible uniqueness for the landowner-builder flow.
// Partial on a real landId (ObjectId) so builder<->buyer and
// builder<->supplier conversations (landId null) never collide.
conversationSchema.index(
  { builderId: 1, landownerId: 1, landId: 1 },
  { unique: true, partialFilterExpression: { landId: { $type: "objectId" } } }
);
// Generic idempotency for the generalized participant pair. Particles must
// be real ObjectIds so legacy (landowner-builder) docs with null
// participantA/participantB are excluded.
conversationSchema.index(
  { context: 1, participantA: 1, participantB: 1 },
  {
    unique: true,
    partialFilterExpression: {
      participantA: { $type: "objectId" },
      participantB: { $type: "objectId" },
    },
  }
);
conversationSchema.index({ participantA: 1 });
conversationSchema.index({ participantB: 1 });

export default mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);
