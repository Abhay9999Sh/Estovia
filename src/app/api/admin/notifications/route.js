import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination } from "@/lib/admin";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import Notification from "@/lib/models/Notification";
import User from "@/lib/models/User";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 25, 100);
  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  const filter = {};
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: re }, { message: re }, { type: re }];
  }

  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);

  const users = await User.find({ _id: { $in: notifications.map((n) => n.userId).filter(Boolean) } }).select("name username email").lean();
  const uById = new Map(users.map((u) => [String(u._id), u]));
  const items = notifications.map((n) => ({ ...n, recipient: uById.get(String(n.userId)) || null }));

  return ok({ items, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});

export const POST = withErrorHandling(async (request) => {
  const admin = await requireAdmin();
  const body = await request.json();
  const mode = sanitizeText(body.mode, 20) || "all";
  const type = sanitizeText(body.type, 40) || "project_update";
  const title = sanitizeText(body.title, 120);
  const message = sanitizeText(body.message, 2000);
  const link = sanitizeText(body.link, 300);
  const role = sanitizeText(body.role, 40);
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((u) => /^[0-9a-fA-F]{24}$/.test(String(u))).map(String) : [];

  if (!title || !message) return fail("Title and message are required.", 400);
  await connectDB();

  let recipients = [];
  if (mode === "specific") {
    recipients = userIds;
  } else if (mode === "role") {
    if (!role) return fail("A role is required for role-based broadcasts.", 400);
    const users = await User.find({ roles: role }).select("_id").lean();
    recipients = users.map((u) => String(u._id));
  } else if (mode === "all") {
    const users = await User.find({}).select("_id").lean();
    recipients = users.map((u) => String(u._id));
  } else {
    return fail("Invalid mode.", 400);
  }

  let errors = 0;
  for (const recipientId of recipients) {
    const created = await createNotification({
      userId: recipientId,
      type,
      title,
      message,
      link,
      metadata: { broadcastBy: String(admin._id) },
    });
    if (!created) errors += 1;
  }

  audit({
    actor: admin._id,
    actorRole: "admin",
    entity: "notification",
    entityId: String(admin._id),
    action: `broadcast_${mode}`,
    reason: `${title} — ${message.slice(0, 200)}`,
    metadata: { mode, recipients: recipients.length, role, type },
  });

  return ok({
    sent: recipients.length - errors,
    requested: recipients.length,
    errors,
    message: errors ? `Broadcast partial: ${recipients.length - errors} sent, ${errors} failed.` : "Broadcast sent successfully.",
  });
});