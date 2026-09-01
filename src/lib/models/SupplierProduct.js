import mongoose from "mongoose";

const supplierProductSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProfile",
      required: true,
      index: true,
    },
    name: { type: String, trim: true, required: true, maxlength: 200 },
    category: { type: String, trim: true, default: "" },
    subcategory: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    unit: { type: String, trim: true, default: "unit" },
    pricePerUnit: { type: Number, min: 0, default: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    currency: { type: String, default: "INR" },
    brand: { type: String, trim: true, default: "" },
    specifications: { type: String, trim: true, default: "" },
    moq: { type: Number, min: 0, default: 0 },
    availableQuantity: { type: Number, min: 0, default: 0 },
    leadTimeDays: { type: Number, min: 0, default: 0 },
    images: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

supplierProductSchema.index({ supplierId: 1, category: 1 });
supplierProductSchema.index({ category: 1, isActive: 1 });

export default mongoose.models.SupplierProduct ||
  mongoose.model("SupplierProduct", supplierProductSchema);
