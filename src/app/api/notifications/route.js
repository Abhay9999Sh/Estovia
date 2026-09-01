import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Notification from "@/lib/models/Notification";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
  await connectDB();

  const notifications = await Notification.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const unread = await Notification.countDocuments({
    userId: user._id,
    read: false,
  });

  return ok({ notifications, unread });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();

  if (body.markAll === true) {
    await connectDB();
    await Notification.updateMany(
      { userId: user._id, read: false },
      { $set: { read: true } }
    );
    return ok({ message: "All notifications marked as read." });
  }
  // Mark specific notifications as read
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) return fail("No notifications specified.", 400);
  await connectDB();
  await Notification.updateMany(
    { userId: user._id, _id: { $in: ids } },
    { $set: { read: true } }
  );
  return ok({ message: "Notifications marked as read." });
});
