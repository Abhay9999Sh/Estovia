/**
 * Audit logging utility. Records an immutable trail of what happened, when,
 * and by whom. Entries are logged to the console AND persisted to the
 * `auditlogs` collection so admins can review them. Persistence is
 * best-effort and fire-and-forget: audit() never blocks or throws.
 */

export function audit({ actor, actorRole, entity, entityId, action, previousStatus, newStatus, reason, metadata = {} }) {
  const entry = {
    actorId: actor ? String(actor) : null,
    actorRole: actorRole || "",
    entity,
    entityId: entityId ? String(entityId) : null,
    action,
    previousStatus: previousStatus || "",
    newStatus: newStatus || "",
    reason: reason || "",
    metadata,
    createdAt: new Date().toISOString(),
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("[audit]", JSON.stringify(entry));
  }

  // Fire-and-forget persistence, never blocks the request or throws.
  Promise.resolve()
    .then(() => {
      // Dynamic import keeps this module safe to use on the client and avoids
      // a hard dependency whenever Mongo is not needed.
      return import("@/lib/models/AuditLog");
    })
    .then(({ default: AuditLog }) => {
      const { createdAt, ...rest } = entry;
      return AuditLog.create({ ...rest, createdAt: new Date(createdAt) });
    })
    .catch(() => {
      // audit must never throw
    });
}