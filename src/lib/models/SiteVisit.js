import mongoose from "mongoose";

const siteVisitSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
    requestedDate: { type: Date, default: null },
    requestedTimeSlot: { type: String, trim: true, default: "" },
    scheduledDate: { type: Date, default: null },
    scheduledTimeSlot: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["Requested", "Scheduled", "Awaiting Confirmation", "Confirmed", "Completed", "Cancelled", "No Show", "Rescheduled"],
      default: "Requested",
    },
    builderNotes: { type: String, trim: true, default: "" },
    checkedInAt: { type: Date, default: null },
    checkedOutAt: { type: Date, default: null },
    createdBy: { type: String, enum: ["buyer", "builder"], default: "buyer" },
  },
  {
    timestamps: true,
  }
);

siteVisitSchema.index({ buyerId: 1 });
siteVisitSchema.index({ builderId: 1, status: 1 });
siteVisitSchema.index({ unitId: 1 });

export default mongoose.models.SiteVisit ||
  mongoose.model("SiteVisit", siteVisitSchema);
