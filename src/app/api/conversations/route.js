import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/lib/models/Conversation";
import Message from "@/lib/models/Message";
import User from "@/lib/models/User";
import LandListing from "@/lib/models/LandListing";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

function pickContext(rolesA, rolesB) {
  const has = (roles, r) => roles.includes(r);
  if (has(rolesA, "builder") && has(rolesB, "landowner")) return "landowner_builder";
  if (has(rolesA, "landowner") && has(rolesB, "builder")) return "landowner_builder";
  if (has(rolesA, "builder") && has(rolesB, "supplier")) return "builder_supplier";
  if (has(rolesA, "supplier") && has(rolesB, "builder")) return "builder_supplier";
  if (has(rolesA, "builder") && has(rolesB, "buyer")) return "builder_buyer";
  if (has(rolesA, "buyer") && has(rolesB, "builder")) return "builder_buyer";
  if (has(rolesA, "landowner") && has(rolesB, "buyer")) return "landowner_buyer";
  if (has(rolesA, "buyer") && has(rolesB, "landowner")) return "landowner_buyer";
  return "general";
}

function buildRoleFields(a, b) {
  const out = {};
  const map = (user) => {
    const roles = user.roles || [];
    if (roles.includes("builder")) out.builderId = user._id;
    if (roles.includes("landowner")) out.landownerId = user._id;
    if (roles.includes("supplier")) out.supplierId = user._id;
    if (roles.includes("buyer")) out.buyerId = user._id;
  };
  map(a);
  map(b);
  return out;
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const conversations = await Conversation.find({
    $or: [
      { participantA: user._id },
      { participantB: user._id },
      { builderId: user._id },
      { landownerId: user._id },
      { supplierId: user._id },
      { buyerId: user._id },
    ],
  })
    .sort({ lastMessageAt: -1 })
    .populate("participantA", "name username avatar roles")
    .populate("participantB", "name username avatar roles")
    .populate("builderId", "name username avatar roles")
    .populate("landownerId", "name username avatar roles")
    .populate("supplierId", "name username avatar roles")
    .populate("buyerId", "name username avatar roles")
    .populate("landId", "title location pricing images")
    .lean();

  if (!conversations.length) return ok({ conversations: [] });

  const ids = conversations.map((c) => c._id);

  const [lastMessages, unreadRows] = await Promise.all([
    Message.aggregate([
      { $match: { conversationId: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          text: { $first: "$text" },
          senderId: { $first: "$senderId" },
          createdAt: { $first: "$createdAt" },
        },
      },
    ]),
    Message.aggregate([
      { $match: { conversationId: { $in: ids }, receiverId: user._id, read: false } },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]),
  ]);
  const lastByConv = new Map(lastMessages.map((m) => [String(m._id), m]));
  const unreadByConv = new Map(unreadRows.map((r) => [String(r._id), r.count]));

  const enriched = conversations.map((c) => {
    const a = c.participantA;
    const b = c.participantB;
    let other = null;
    if (a && String(a._id) !== String(user._id)) other = a;
    else if (b && String(b._id) !== String(user._id)) other = b;
    if (!other) {
      other =
        c.builderId && String(c.builderId._id) !== String(user._id)
          ? c.builderId
          : c.landownerId && String(c.landownerId._id) !== String(user._id)
          ? c.landownerId
          : c.supplierId && String(c.supplierId._id) !== String(user._id)
          ? c.supplierId
          : c.buyerId && String(c.buyerId._id) !== String(user._id)
          ? c.buyerId
          : b || a || null;
    }
    const lm = lastByConv.get(String(c._id));
    return {
      _id: c._id,
      context: c.context,
      lastMessageAt: c.lastMessageAt,
      landId: c.landId || null,
      updatedAt: c.updatedAt,
      otherId: other ? String(other._id) : null,
      other,
      lastMessage: lm || null,
      unreadCount: unreadByConv.get(String(c._id)) || 0,
    };
  });

  return ok({ conversations: enriched });
});

/**
 * POST: Start a conversation between any two platform users.
 * Idempotent - returns the existing conversation if a matching pair exists.
 */
export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();

  const recipientId = String(body.recipientId || "");
  if (!mongoose.isValidObjectId(recipientId)) {
    return fail("Please choose a recipient to message.", 400);
  }
  if (String(recipientId) === String(user._id)) {
    return fail("You cannot message yourself.", 400);
  }

  await connectDB();

  const [me, them] = await Promise.all([User.findById(user._id), User.findById(recipientId)]);
  if (!them) return fail("Recipient not found.", 404);
  if ((me.roles || []).includes("admin") || (them.roles || []).includes("admin")) {
    return fail("Admins cannot be messaged through this channel.", 403);
  }
  if (["suspended", "deactivated"].includes(them.accountStatus)) {
    return fail("This account is not available for messaging.", 403);
  }

  const pair = [me._id, them._id]
    .map(String)
    .sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
    .map((s) => new mongoose.Types.ObjectId(s));

  const [participantA, participantB] = pair;

  let context = pickContext(me.roles || [], them.roles || []);

  // If a listing is supplied, keep the landowner-builder flow tied to it.
  let landId = null;
  if (body.landId && mongoose.isValidObjectId(body.landId)) {
    const listing = await LandListing.findById(body.landId);
    if (listing && (String(listing.ownerId) === String(me._id) || String(listing.ownerId) === String(them._id))) {
      landId = listing._id;
      if (context === "general") context = "landowner_builder";
    }
  }

  const roleFields = buildRoleFields(me, them);

  const existing = await Conversation.findOne({ context, participantA, participantB });
  if (existing) {
    return ok({ conversation: existing, message: "Conversation already exists." });
  }

  const conversation = await Conversation.create({
    participantA,
    participantB,
    context,
    landId,
    ...roleFields,
    lastMessageAt: null,
  });

  return ok({ conversation, message: "Conversation started." }, 201);
});