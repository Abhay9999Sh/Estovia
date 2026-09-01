import mongoose from "mongoose";

const projectUnitSchema = new mongoose.Schema(
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
    unitNumber: { type: String, trim: true, default: "" },
    tower: { type: String, trim: true, default: "" },
    floor: { type: String, trim: true, default: "" },

    unitType: {
      type: String,
      enum: ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Penthouse", "Studio", "Office", "Retail", "Villa", "Plot", "Other", ""],
      default: "",
    },
    configuration: { type: String, trim: true, default: "" },
    sizeSqFt: { type: Number, min: 0, default: 0 },

    carpetAreaSqFt: { type: Number, min: 0, default: 0 },
    builtUpAreaSqFt: { type: Number, min: 0, default: 0 },

    price: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "INR" },
    pricePerSqFt: { type: Number, min: 0, default: 0 },

    facing: { type: String, trim: true, default: "" },
    amenities: { type: [String], default: [] },
    description: { type: String, trim: true, default: "" },
    images: { type: [String], default: [] },
    floorPlanImage: { type: String, default: "" },

    possessionDate: { type: Date, default: null },
    reraCovered: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["Draft", "Available", "On Hold", "Reserved", "Booked", "Sold", "Registered", "Cancelled", "Under Maintenance"],
      default: "Draft",
    },

    // Booking / buyer linkage
    bookedByBuyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyerApplication",
      default: null,
    },
    soldAt: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

projectUnitSchema.index({ projectId: 1, status: 1 });
projectUnitSchema.index({ status: 1, isActive: 1 });
projectUnitSchema.index({ builderId: 1 });

export default mongoose.models.ProjectUnit ||
  mongoose.model("ProjectUnit", projectUnitSchema);
