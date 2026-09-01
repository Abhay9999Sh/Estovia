import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/lib/models/Conversation";
import Message from "@/lib/models/Message";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

// Resolve the two participant user ids of a conversation.
function participants(conversation) {
  const ids = [];
  if (conversation.builderId) ids.push(String(conversation.builderId));
  if (conversation.landownerId) ids.push(String(conversation.landownerId));
  if (conversation.buyerId) ids.push(String(conversation.buyerId));
  if (conversation.supplierId) ids.push(String(conversation.supplierId));
  const seen = new Set();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Resolve the appropriate messages URL for a given participant user.
function messagesLinkFor(userId, conversation) {
  if (String(conversation.builderId) === String(userId)) return "/builder/messages";
  if (String(conversation.landownerId) === String(userId)) return "/landowner/messages";
  if (String(conversation.buyerId) === String(userId)) return "/buyer/messages";
  if (String(conversation.supplierId) === String(userId)) return "/supplier/messages";
  return "/messages";
}

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Conversation not found.", 400);

  await connectDB();
  const conversation = await Conversation.findById(id);
  if (!conversation) return fail("Conversation not found.", 404);

  const ids = participants(conversation);
  if (!ids.includes(String(user._id))) {
    return fail("You are not authorized to view this conversation.", 403);
  }

  const receiverId = ids.find((p) => p !== String(user._id));

  // Mark inbound messages as read
  await Message.updateMany(
    { conversationId: id, receiverId: user._id, read: false },
    { $set: { read: true } }
  );

  const messages = await Message.find({ conversationId: id })
    .sort({ createdAt: 1 })
    .lean();

  // Attach the other participant id for the client.
  return ok({
    messages,
    otherParticipantId: receiverId || null,
    context: conversation.context,
  });
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Conversation not found.", 400);

  const body = await request.json();
  const text = sanitizeText(body.text, 4000);
  if (!text.trim()) return fail("Message cannot be empty.", 400);

  await connectDB();
  const conversation = await Conversation.findById(id);
  if (!conversation) return fail("Conversation not found.", 404);

  const ids = participants(conversation);
  if (!ids.includes(String(user._id))) {
    return fail("You are not authorized to send messages here.", 403);
  }

  const receiverId = ids.find((p) => p !== String(user._id));
  if (!receiverId) return fail("Invalid conversation.", 400);

  const attachments = Array.isArray(body.attachments)
    ? body.attachments.slice(0, 5).map((u) => sanitizeText(u, 500))
    : [];

  const message = await Message.create({
    conversationId: id,
    senderId: user._id,
    receiverId,
    text,
    attachments,
  });

  conversation.lastMessageAt = new Date();
  await conversation.save();

  await createNotification({
    userId: receiverId,
    type: "new_message",
    title: "New message",
    message: text.length > 100 ? text.slice(0, 100) + "…" : text,
    entityType: "conversation",
    entityId: conversation._id,
    link: messagesLinkFor(receiverId, conversation),
    metadata: { conversationId: conversation._id, messageId: message._id },
  });

  return ok({ message, sentAt: new Date() }, 201);
});
