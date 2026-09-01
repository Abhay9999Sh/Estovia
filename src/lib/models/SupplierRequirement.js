import mongoose from "mongoose";

/**
 * A procurement requirement published by a Builder for suppliers to quote on.
 * This represents the "Req → Quotation → Order" chain for the procurement module.
 */
const requirementSchema = new mongoose.Schema(
  {
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    // Optional link back to the original material requirement
    materialRequirementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialRequirement",
      default: null,
    },

    title: { type: String, trim: true, required: true, maxlength: 200 },
    category: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    lineItems: [
      {
        item: { type: String, trim: true, default: "" },
        quantity: { type: Number, min: 0, default: 0 },
        unit: { type: String, trim: true, default: "" },
        specification: { type: String, trim: true, default: "" },
        _id: false,
      },
    ],
    estimatedValue: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "INR" },
    deliveryLocation: { type: String, trim: true, default: "" },
    requiredBy: { type: Date, default: null },
    validUntil: { type: Date, default: null },

    // Visibility: private = invited suppliers only, public = all matching suppliers
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    invitedSupplierIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "SupplierProfile", default: [] },
    ],

    status: {
      type: String,
      enum: ["Draft", "Open", "Responses Received", "Shortlisted", "Quotation Selected", "Order Placed", "Fulfilled", "Cancelled", "Closed"],
      default: "Draft",
    },

    // Selected supplier after comparison
    selectedSupplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProfile",
      default: null,
    },
    selectedQuotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      default: null,
    },
    awardNote: { type: String, trim: true, default: "" },
    closedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

requirementSchema.index({ builderId: 1, status: 1 });
requirementSchema.index({ projectId: 1, status: 1 });
requirementSchema.index({ category: 1, status: 1 });

export default mongoose.models.SupplierRequirement ||
  mongoose.model("SupplierRequirement", requirementSchema);
