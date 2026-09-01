import mongoose from "mongoose";

const buyerInquirySchema = new mongoose.Schema(
  {
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
    type: {
      type: String,
      enum: ["Project Inquiry", "Unit Inquiry", "General", "Finance", "Site Visit", "Other"],
      default: "Project Inquiry",
    },
    message: { type: String, trim: true, default: "", maxlength: 2000 },
    contact: {
      name: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
    },
    status: {
      type: String,
      enum: ["New", "Open", "Responded", "Closed", "Converted"],
      default: "New",
    },
    source: { type: String, trim: true, default: "Marketplace" },
  },
  {
    timestamps: true,
  }
);

buyerInquirySchema.index({ buyerId: 1 });
buyerInquirySchema.index({ builderId: 1, status: 1 });
buyerInquirySchema.index({ unitId: 1 });

export default mongoose.models.BuyerInquiry ||
  mongoose.model("BuyerInquiry", buyerInquirySchema);
