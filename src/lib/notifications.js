import Notification from "@/lib/models/Notification";

/**
 * Create a notification for a user. Safe to call after connectDB().
 */
export async function createNotification({
  userId,
  type,
  title = "",
  message = "",
  entityType = "",
  entityId = null,
  link = "",
  metadata = {},
}) {
  if (!userId) return null;
  try {
    const n = await Notification.create({
      userId,
      type,
      title,
      message,
      entityType,
      entityId,
      link,
      metadata,
    });
    return n;
  } catch (err) {
    // Notifications are best-effort; never fail an operation because of one.
    console.error("Notification error:", err);
    return null;
  }
}
