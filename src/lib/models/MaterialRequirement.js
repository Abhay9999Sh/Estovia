import mongoose from "mongoose";

const materialRequirementSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    material: { type: String, trim: true, required: true },
    category: { type: String, trim: true, default: "" },
    quantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, trim: true, default: "" },
    requiredBy: { type: Date, default: null },
    description: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["Open", "Quotation Received", "Shortlisted", "Awarded", "Closed"],
      default: "Open",
    },
  },
  {
    timestamps: true,
  }
);

materialRequirementSchema.index({ projectId: 1, status: 1 });

export default mongoose.models.MaterialRequirement ||
  mongoose.model("MaterialRequirement", materialRequirementSchema);
