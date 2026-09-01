import mongoose from "mongoose";

const applicationStepSchema = new mongoose.Schema(
  {
    step: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Blocked"],
      default: "Pending",
    },
    completedAt: { type: Date, default: null },
    _id: false,
  },
  { _id: false }
);

/**
 * Buyer application / booking flow. Payments are architectural only —
 * amounts are always "Pending Verification"/"Manual Review".
 */
const buyerApplicationSchema = new mongoose.Schema(
  {
    applicationNumber: { type: String, trim: true, default: "" },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    buyerProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyerProfile",
      default: null,
    },
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
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

    unitDetails: {
      unitNumber: { type: String, trim: true, default: "" },
      tower: { type: String, trim: true, default: "" },
      floor: { type: String, trim: true, default: "" },
      unitType: { type: String, trim: true, default: "" },
      sizeSqFt: { type: Number, min: 0, default: 0 },
      price: { type: Number, min: 0, default: 0 },
    },

    buyerDetails: {
      name: { type: String, trim: true, default: "" },
      pan: { type: String, trim: true, uppercase: true, default: "" },
      email: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
      coApplicants: { type: [String], default: [] },
    },

    documents: {
      type: [
        {
          name: { type: String, trim: true, default: "" },
          url: { type: String, default: "" },
          status: {
            type: String,
            enum: ["Pending", "Submitted", "Verified", "Rejected"],
            default: "Pending",
          },
        },
      ],
      default: [],
    },

    financing: {
      required: { type: Boolean, default: false },
      mode: { type: String, trim: true, default: "" },
      loanAmount: { type: Number, min: 0, default: 0 },
    },

    status: {
      type: String,
      enum: ["Initiated", "Personal Details", "Document Upload", "Verification/Review", "Offer Stage", "Financing", "Payment", "Awaiting Allotment", "Allotted", "Registered", "Closed", "Cancelled", "Rejected"],
      default: "Initiated",
    },
    steps: { type: [applicationStepSchema], default: [] },

    payment: {
      amount: { type: Number, min: 0, default: 0 },
      paid: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["Not Required", "Pending", "Manual Review", "Initiated", "Partial", "Completed"],
        default: "Pending",
      },
      method: { type: String, trim: true, default: "" },
    },

    builderApproval: {
      status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
      note: { type: String, trim: true, default: "" },
    },
    rejectionReason: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
  }
);

buyerApplicationSchema.index({ buyerId: 1 });
buyerApplicationSchema.index({ builderId: 1, status: 1 });
buyerApplicationSchema.index({ unitId: 1 });

export default mongoose.models.BuyerApplication ||
  mongoose.model("BuyerApplication", buyerApplicationSchema);
