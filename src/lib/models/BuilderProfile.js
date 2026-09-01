import mongoose from "mongoose";

const operatingLocationSchema = new mongoose.Schema(
  {
    state: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    area: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const reraRegistrationSchema = new mongoose.Schema(
  {
    state: { type: String, trim: true, default: "" },
    registrationNumber: { type: String, trim: true, uppercase: true, default: "" },
    promoterName: { type: String, trim: true, default: "" },
    projectName: { type: String, trim: true, default: "" },
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

const builderProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // STEP 1 - Personal
    fullName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    designation: {
      type: String,
      enum: ["Founder", "Director", "Partner", "Promoter", "Authorized Representative", "Other", ""],
      default: "",
    },
    avatar: { type: String, default: "" },

    // STEP 2 - Company
    companyName: { type: String, trim: true, default: "" },
    businessType: {
      type: String,
      enum: ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Individual Developer", "Other", ""],
      default: "",
    },
    cin: { type: String, trim: true, uppercase: true, default: "" },
    llpin: { type: String, trim: true, uppercase: true, default: "" },
    pan: { type: String, trim: true, uppercase: true, default: "" },
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    registeredAddress: { type: String, trim: true, default: "" },
    officeAddress: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
    businessEmail: { type: String, trim: true, lowercase: true, default: "" },
    businessPhone: { type: String, trim: true, default: "" },
    yearEstablished: { type: String, trim: true, default: "" },

    // STEP 3 - Business verification state (never faked)
    verification: {
      business: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      pan: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      gst: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      mca: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      address: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
    },

    // STEP 4 - Experience
    yearsOfExperience: { type: Number, min: 0, default: 0 },
    completedProjects: { type: Number, min: 0, default: 0 },
    ongoingProjects: { type: Number, min: 0, default: 0 },
    specializations: { type: [String], default: [] },
    developmentAreas: { type: [String], default: [] },
    propertyTypes: {
      type: [String],
      default: [],
      enum: ["Residential", "Commercial", "Industrial", "Mixed Use", "Plotted Development", "Township", "Luxury Housing", "Affordable Housing", "Other"],
    },
    budgetRange: {
      min: { type: Number, min: 0, default: 0 },
      max: { type: Number, min: 0, default: 0 },
    },

    // STEP 5 - Operating locations
    operatingLocations: { type: [operatingLocationSchema], default: [] },

    // STEP 6 - RERA
    reraRegistrations: { type: [reraRegistrationSchema], default: [] },

    // Company logo / documents
    logo: { type: String, default: "" },
    companyDocuments: {
      type: [String],
      default: [],
    },

    bio: { type: String, trim: true, default: "" },

    onboardingComplete: { type: Boolean, default: false },
    reviewNotes: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

builderProfileSchema.index({ userId: 1 });
builderProfileSchema.index({ companyName: 1 });

export default mongoose.models.BuilderProfile ||
  mongoose.model("BuilderProfile", builderProfileSchema);
