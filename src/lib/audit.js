/**
 * Lightweight audit logging utility. Records important business actions so
 * there is an immutable trail of what happened and when, performed by whom.
 *
 * Currently logs to the server console with a structured entry. This keeps
 * the proposal/verification history honest without requiring a separate
 * collection. Swap the sink for a Mongo collection/event bus when needed.
 */

export function audit({ actor, entity, entityId, action, metadata = {} }) {
  try {
    const entry = {
      ts: new Date().toISOString(),
      actor: actor ? String(actor) : null,
      entity,
      entityId: entityId ? String(entityId) : null,
      action,
      metadata,
    };
    if (process.env.NODE_ENV !== "production") {
      console.log("[audit]", JSON.stringify(entry));
    }
  } catch (err) {
    // audit must never throw
  }
}
