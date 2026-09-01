import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "interest_accepted",
        "interest_rejected",
        "new_interest",
        "proposal_received",
        "proposal_accepted",
        "proposal_rejected",
        "counter_offer",
        "new_message",
        "document_shared",
        "rera_update",
        "project_update",
        "supplier_response",
        "buyer_inquiry",
        "interest_withdrawn",
      ],
      required: true,
    },
    title: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, default: "" },
    entityType: { type: String, default: "" }, // e.g. "interest", "proposal", "project"
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, read: 1 });

export default mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
