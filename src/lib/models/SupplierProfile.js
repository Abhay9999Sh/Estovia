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

const supplierProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // STEP 1 - Personal
    ownerName: { type: String, trim: true, default: "" },
    fullName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    designation: {
      type: String,
      enum: ["Owner", "Director", "Partner", "Manager", "Authorized Representative", "Other", ""],
      default: "",
    },
    avatar: { type: String, default: "" },

    // STEP 2 - Business / Company
    businessName: { type: String, trim: true, default: "" },
    businessType: {
      type: String,
      enum: ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Sole Trader", "Other", ""],
      default: "",
    },
    category: {
      type: String,
      enum: ["Materials", "Equipment", "Labour", "Services", "Fittings & Finishes", "Other", ""],
      default: "",
    },
    subcategories: { type: [String], default: [] },
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    pan: { type: String, trim: true, uppercase: true, default: "" },
    udyam: { type: String, trim: true, uppercase: true, default: "" },
    registeredAddress: { type: String, trim: true, default: "" },
    officeAddress: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
    businessEmail: { type: String, trim: true, lowercase: true, default: "" },
    businessPhone: { type: String, trim: true, default: "" },
    yearEstablished: { type: String, trim: true, default: "" },

    // STEP 3 - Verification state (never faked)
    verification: {
      business: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      gst: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      pan: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      udyam: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
      address: { type: String, default: "pending", enum: ["pending", "submitted", "verified", "rejected"] },
    },

    // STEP 4 - Business details
    yearsOfExperience: { type: Number, min: 0, default: 0 },
    deliveryCapability: { type: String, trim: true, default: "" },
    serviceableStates: { type: [String], default: [] },
    operatingLocations: { type: [operatingLocationSchema], default: [] },
    productCategories: { type: [String], default: [] },
    serviceCategories: { type: [String], default: [] },
    brandsDealt: { type: [String], default: [] },
    certifications: { type: [String], default: [] },

    logo: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    companyDocuments: { type: [String], default: [] },

    bio: { type: String, trim: true, default: "" },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },
    orderCount: { type: Number, min: 0, default: 0 },
    isOpen: { type: Boolean, default: true },

    onboardingComplete: { type: Boolean, default: false },
    reviewNotes: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

supplierProfileSchema.index({ userId: 1 });
supplierProfileSchema.index({ businessName: 1 });
supplierProfileSchema.index({ category: 1 });

export default mongoose.models.SupplierProfile ||
  mongoose.model("SupplierProfile", supplierProfileSchema);
