import mongoose from "mongoose";

const supplierServiceSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProfile",
      required: true,
      index: true,
    },
    name: { type: String, trim: true, required: true, maxlength: 200 },
    category: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    pricingModel: {
      type: String,
      enum: ["Per Project", "Per Sq Ft", "Per Day", "Hourly", "Fixed", "Negotiable", ""],
      default: "",
    },
    price: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "INR" },
    serviceableStates: { type: [String], default: [] },
    serviceableCities: { type: [String], default: [] },
    turnaroundDays: { type: Number, min: 0, default: 0 },
    portfolioImages: { type: [String], default: [] },
    equipmentDetails: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

supplierServiceSchema.index({ supplierId: 1, category: 1 });
supplierServiceSchema.index({ category: 1, isActive: 1 });

export default mongoose.models.SupplierService ||
  mongoose.model("SupplierService", supplierServiceSchema);
