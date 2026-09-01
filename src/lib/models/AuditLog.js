import mongoose from "mongoose";

/**
 * Immutable audit trail. Every meaningful action (admin or user) can produce an
 * entry here so there is a complete, reviewable history. Deliberately no update
 * / delete routes exist for this collection.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorRole: { type: String, default: "" },
    action: { type: String, default: "", index: true },
    entity: { type: String, default: "" },
    entityId: { type: String, default: "" },
    previousStatus: { type: String, default: "" },
    newStatus: { type: String, default: "" },
    reason: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

export default mongoose.models.AuditLog ||
  mongoose.model("AuditLog", auditLogSchema);