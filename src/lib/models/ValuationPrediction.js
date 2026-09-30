import mongoose from "mongoose";

const modelMetaSchema = new mongoose.Schema(
  {
    modelId: { type: String, required: true },
    modelVersion: { type: String, default: "" },
    segment: { type: String, required: true },
    estimator: { type: String, default: "" },
    trainedAt: { type: Date, default: null },
    featureSchemaVersion: { type: String, default: "" },
    target: { type: String, default: "" },
    // Persisted so a re-run can tell whether two predictions are comparable at all
    targetSemantics: { type: String, default: "" },
  },
  { _id: false }
);

const inputSnapshotSchema = new mongoose.Schema(
  {
    propertyCategory: { type: String, required: true },
    city: { type: String, default: "" },
    locality: { type: String, default: "" },
    state: { type: String, default: "" },
    district: { type: String, default: "" },
    pincode: { type: String, default: "" },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    areaSqFt: { type: Number, required: true },
    areaDefinition: { type: String, default: "built_up" },
    areaValueOriginal: { type: Number, default: null },
    areaUnitOriginal: { type: String, default: "" },
    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },
    balconies: { type: Number, default: null },
    floorNumber: { type: Number, default: null },
    totalFloors: { type: Number, default: null },
    propertyAgeYears: { type: Number, default: null },
    facing: { type: String, default: "" },
    furnishing: { type: String, default: "" },
    ownership: { type: String, default: "" },
    transactionType: { type: String, default: "" },
    liftAvailable: { type: Boolean, default: null },
    parkingCount: { type: Number, default: null },
    amenities: { type: [String], default: [] },
    geoDataAvailable: { type: Boolean, default: false },
    // Names of fields the caller omitted, so the coverage layer can explain itself
    missingInputs: { type: [String], default: [] },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    valueInr: { type: Number, default: null },
    lowInr: { type: Number, default: null },
    highInr: { type: Number, default: null },
    pricePerSqFt: { type: Number, default: null },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: [
        "ok",
        "unsupported_location",
        "unsupported_category",
        "no_model_for_segment",
        "insufficient_data",
        "out_of_distribution",
        "invalid_input",
      ],
      required: true,
    },
    message: { type: String, default: "" },
  },
  { _id: false }
);

const coverageSchema = new mongoose.Schema(
  {
    intervalMethod: { type: String, default: "" },
    intervalAlpha: { type: Number, default: null },
    intervalQ: { type: Number, default: null },
    intervalNominalCoveragePct: { type: Number, default: null },
    intervalMeasuredCoveragePct: { type: Number, default: null },
    intervalNCalibration: { type: Number, default: null },
    coverageLevel: {
      type: String,
      enum: ["sufficient", "limited", "low", "out_of_distribution", "unsupported"],
      default: "low",
    },
    coverageLabel: { type: String, default: "" },
    comparableCount: { type: Number, default: 0 },
    localityObservations: { type: Number, default: 0 },
    coverageReasons: { type: [String], default: [] },
  },
  { _id: false }
);

const factorSchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    label: { type: String, default: "" },
    group: { type: String, default: "" },
    direction: {
      type: String,
      enum: ["increase", "decrease", "neutral"],
      default: "neutral",
    },
    contributionPct: { type: Number, default: null },
    display: { type: String, default: "" },
  },
  { _id: false }
);

const comparableSchema = new mongoose.Schema(
  {
    locality: { type: String, default: "" },
    areaSqFt: { type: Number, default: null },
    bedrooms: { type: Number, default: null },
    priceInr: { type: Number, default: null },
    pricePerSqFt: { type: Number, default: null },
    propertyCategory: { type: String, default: "" },
    targetType: { type: String, default: "" },
    sourceKey: { type: String, default: "" },
    licenseKey: { type: String, default: "" },
    retrievedAt: { type: String, default: "" },
    projectName: { type: String, default: "" },
  },
  { _id: false }
);

const explainabilitySchema = new mongoose.Schema(
  {
    explanationMethod: { type: String, default: "" },
    factors: { type: [factorSchema], default: [] },
    comparableCount: { type: Number, default: 0 },
    comparables: { type: [comparableSchema], default: [] },
    limitations: { type: [String], default: [] },
  },
  { _id: false }
);

// The user's own price, kept apart from result.valueInr so the two can never be conflated
const askComparisonSchema = new mongoose.Schema(
  {
    askingPriceInr: { type: Number, default: null },
    askingPriceType: { type: String, default: "" },
    differenceInr: { type: Number, default: null },
    differencePct: { type: Number, default: null },
    comparisonBasis: { type: String, default: "" },
    comparingField: {
      type: String,
      enum: ["none", "listing", "unit", "project"],
      default: "none",
    },
  },
  { _id: false }
);

const valuationPredictionSchema = new mongoose.Schema(
  {
    // Deliberately no PII fields: a valuation record holds no owner/contact/document data
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    listingRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LandListing",
      index: true,
      default: null,
    },
    unitRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectUnit",
      index: true,
      default: null,
    },
    projectRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true,
      default: null,
    },
    requestContext: {
      type: String,
      enum: [
        "landowner_listing_form",
        "landowner_dashboard",
        "builder_project",
        "builder_unit",
        "buyer_property_detail",
        "standalone_estimate",
        "admin_tool",
      ],
      default: "standalone_estimate",
    },
    // Rate-limit bucket key only, never a raw IP
    sessionId: { type: String, default: "" },

    modelMeta: { type: modelMetaSchema, default: () => ({}) },
    inputSnapshot: { type: inputSnapshotSchema, default: () => ({}) },
    result: { type: resultSchema, default: () => ({}) },
    coverage: { type: coverageSchema, default: () => ({}) },
    explainability: { type: explainabilitySchema, default: () => ({}) },
    askComparison: { type: askComparisonSchema, default: () => ({}) },

    valuationDate: { type: Date, required: true, default: Date.now },
    asOfDataThrough: { type: String, default: "" },
    engineVersion: { type: String, default: "valuation.v1" },
  },
  {
    timestamps: true,
  }
);

valuationPredictionSchema.index({ requestedBy: 1, createdAt: -1 });
valuationPredictionSchema.index({ listingRef: 1, createdAt: -1 });
valuationPredictionSchema.index({ unitRef: 1, createdAt: -1 });
valuationPredictionSchema.index({ projectRef: 1, createdAt: -1 });
valuationPredictionSchema.index({ "result.status": 1, createdAt: -1 });
valuationPredictionSchema.index({ "coverage.coverageLevel": 1 });
valuationPredictionSchema.index({ "modelMeta.modelId": 1 });

export default mongoose.models.ValuationPrediction ||
  mongoose.model("ValuationPrediction", valuationPredictionSchema);
