import mongoose from "mongoose";

const reraInfoSchema = new mongoose.Schema(
  {
    state: { type: String, trim: true, default: "" },
    registrationNumber: { type: String, trim: true, uppercase: true, default: "" },
    promoterName: { type: String, trim: true, default: "" },
    projectName: { type: String, trim: true, default: "" },
    registrationDate: { type: Date, default: null },
    completionDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "submitted", "verified", "not_found", "mismatch", "manual_review", "inactive"],
      default: "pending",
    },
    verifiedAt: { type: Date, default: null },
    source: { type: String, default: "" },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Please provide a project name"],
      trim: true,
      maxlength: [160, "Project name cannot be longer than 160 characters"],
    },
    description: { type: String, trim: true, default: "" },

    projectType: {
      type: String,
      enum: ["Residential", "Commercial", "Industrial", "Mixed Use", "Plotted Development", "Township", "Other"],
      default: "Residential",
    },

    // Optional association with an existing land listing. The builder MUST
    // have an authorized relationship (interest/proposal) with that land
    // before they can attach it to a project.
    landId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LandListing",
      default: null,
      index: true,
    },
    landownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    location: {
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      district: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },

    estimatedBudget: { type: Number, min: 0, default: 0 },
    startDate: { type: Date, default: null },
    completionDate: { type: Date, default: null },

    status: {
      type: String,
      enum: ["Planning", "Land Acquisition", "Documentation", "Approvals", "Under Construction", "Completed", "On Hold", "Cancelled"],
      default: "Planning",
    },

    // RERA information for this specific project
    rera: { type: reraInfoSchema, default: () => ({}) },

    images: { type: [String], default: [] },
    documents: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProjectDocument" }],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ builderId: 1, status: 1 });
projectSchema.index({ landId: 1 });

export default mongoose.models.Project ||
  mongoose.model("Project", projectSchema);
