import mongoose from "mongoose";

const orderLineSchema = new mongoose.Schema(
  {
    item: { type: String, trim: true, default: "" },
    quantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, trim: true, default: "" },
    unitPrice: { type: Number, min: 0, default: 0 },
    lineTotal: { type: Number, min: 0, default: 0 },
    _id: false,
  },
  { _id: false }
);

const deliveryMilestoneSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: "" },
    scheduledDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Delayed"],
      default: "Pending",
    },
    _id: false,
  },
  { _id: false }
);

/**
 * An Order (engagement) created from an accepted Quotation. Payment amounts
 * are always shown as "Pending Verification"/"Manual Review" — never faked.
 */
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, trim: true, default: "" },
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    supplierProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProfile",
      required: true,
      index: true,
    },
    requirementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierRequirement",
      default: null,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      default: null,
    },

    lines: { type: [orderLineSchema], default: [] },
    subtotal: { type: Number, min: 0, default: 0 },
    taxes: { type: Number, min: 0, default: 0 },
    deliveryCharges: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "INR" },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "In Production", "In Transit", "Delivered", "Partially Delivered", "Completed", "Cancelled", "Disputed"],
      default: "Pending",
    },
    payment: {
      amount: { type: Number, min: 0, default: 0 },
      status: {
        type: String,
        enum: ["Not Required", "Pending", "Manual Review", "Initiated", "Partially Paid", "Completed"],
        default: "Pending",
      },
      method: { type: String, trim: true, default: "" },
      reference: { type: String, trim: true, default: "" },
    },
    deliveryAddress: { type: String, trim: true, default: "" },
    expectedDelivery: { type: Date, default: null },
    actualDelivery: { type: Date, default: null },
    milestones: { type: [deliveryMilestoneSchema], default: [] },
    terms: { type: String, trim: true, default: "" },
    cancellationReason: { type: String, trim: true, default: "" },
    disputeNote: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ builderId: 1, status: 1 });
orderSchema.index({ supplierProfileId: 1, status: 1 });
orderSchema.index({ projectId: 1 });

export default mongoose.models.Order ||
  mongoose.model("Order", orderSchema);
