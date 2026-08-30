import mongoose from "mongoose";

const areaSchema = new mongoose.Schema(
  {
    value: { type: Number, min: 0 },
    unit: {
      type: String,
      enum: ["sqft", "sqm", "acre", "hectare", "gunta", "bigha", "marla"],
      default: "sqft",
    },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    district: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    tehsil: { type: String, default: "" },
    village: { type: String, default: "" },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { _id: false }
);

const boundarySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Polygon"], default: "Polygon" },
    coordinates: { type: [[[Number]]], default: [] },
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    amount: { type: Number, min: 0, default: 0 },
    type: {
      type: String,
      enum: ["total", "per_sqft", "per_acre", "negotiable"],
      default: "total",
    },
    negotiable: { type: Boolean, default: false },
  },
  { _id: false }
);

const landListingSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Please provide a title"],
      trim: true,
      maxlength: [120, "Title cannot be longer than 120 characters"],
    },
    description: { type: String, default: "", trim: true },
    propertyType: {
      type: String,
      enum: ["land", "residential", "commercial", "apartment", "plot", "project"],
      default: "land",
    },
    landUse: {
      type: String,
      enum: [
        "agricultural",
        "residential",
        "commercial",
        "industrial",
        "mixed",
        "farmhouse",
        "institutional",
      ],
      default: "agricultural",
    },

    area: { type: areaSchema, default: () => ({}) },
    location: { type: locationSchema, default: () => ({}) },
    boundary: { type: boundarySchema, default: () => ({}) },
    pricing: { type: pricingSchema, default: () => ({}) },

    surveyNumber: { type: String, default: "" },
    khasraNumber: { type: String, default: "" },

    images: {
      type: [String],
      default: [],
    },

    views: { type: Number, default: 0 },
    interestedUsers: { type: Number, default: 0 },

    verificationStatus: {
      type: String,
      default: "draft",
      enum: ["draft", "submitted", "under_review", "partially_verified", "verified", "rejected"],
    },
    status: {
      type: String,
      default: "draft",
      enum: ["draft", "active", "paused", "sold", "rejected"],
    },

    reviewNotes: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

landListingSchema.index({ ownerId: 1, status: 1 });
landListingSchema.index({ "location.city": 1, "location.state": 1 });
landListingSchema.index({ "location.latitude": 1, "location.longitude": 1 });
landListingSchema.index({ propertyType: 1 });
landListingSchema.index({ verificationStatus: 1 });
landListingSchema.index({ status: 1 });

export default mongoose.models.LandListing ||
  mongoose.model("LandListing", landListingSchema);
