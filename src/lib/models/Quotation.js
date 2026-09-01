import mongoose from "mongoose";

const quotationLineSchema = new mongoose.Schema(
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

const quotationSchema = new mongoose.Schema(
  {
    requirementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierRequirement",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    supplierProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProfile",
      required: true,
      index: true,
    },
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lineItems: { type: [quotationLineSchema], default: [] },
    subtotal: { type: Number, min: 0, default: 0 },
    taxes: {
      gstRate: { type: Number, min: 0, max: 100, default: 0 },
      gstAmount: { type: Number, min: 0, default: 0 },
      otherTaxes: { type: Number, min: 0, default: 0 },
    },
    transportCharges: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "INR" },
    validUntil: { type: Date, default: null },
    leadTimeDays: { type: Number, min: 0, default: 0 },
    paymentTerms: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    // Immutable history: each new/counter offer appends a snapshot of the
    // previous offer rather than overwriting it.
    revisionHistory: {
      type: [
        {
          revision: { type: Number, default: 0 },
          from: {
            type: String,
            enum: ["supplier", "builder"],
            default: "supplier",
          },
          subtotal: { type: Number, min: 0, default: 0 },
          totalAmount: { type: Number, min: 0, default: 0 },
          note: { type: String, trim: true, default: "" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    status: {
      type: String,
      enum: ["Pending", "Submitted", "Received", "Under Review", "Negotiation", "Accepted", "Declined", "Withdrawn", "Expired"],
      default: "Pending",
    },
    isCounterOffer: { type: Boolean, default: false },
    revision: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

quotationSchema.index({ requirementId: 1, supplierProfileId: 1 });
quotationSchema.index({ supplierProfileId: 1, status: 1 });

export default mongoose.models.Quotation ||
  mongoose.model("Quotation", quotationSchema);
