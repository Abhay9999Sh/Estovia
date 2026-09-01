import mongoose from "mongoose";
import Conversation from "@/lib/models/Conversation";

/**
 * Build a canonical conversation idempotency key.
 * participantA/participantB are sorted so that (A,B) == (B,A).
 */
function sortPair(a, b) {
  return String(a) < String(b) ? [a, b] : [b, a];
}

/**
 * Find or create a conversation between two *user* participants for a context.
 * @param {Object} opts
 * @param {string} opts.context - one of the Conversation.context values
 * @param {string} opts.participantIds - [userA, userB]
 * @param {Object} [opts.extra] - additional fields (landId, projectId, etc.)
 */
export async function findOrCreateConversation({
  context,
  participantIds,
  extra = {},
}) {
  const [pa, pb] = sortPair(participantIds[0], participantIds[1]);

  const base = { context, participantA: pa, participantB: pb };
  let conversation = await Conversation.findOne(base);

  if (!conversation) {
    conversation = await Conversation.create({
      ...base,
      participantA: pa,
      participantB: pb,
      ...extra,
      lastMessageAt: null,
    });
  } else if (Object.keys(extra).length) {
    // Backfill contextual references on an existing conversation.
    for (const key of Object.keys(extra)) {
      if (extra[key] && !conversation[key]) {
        conversation[key] = extra[key];
      }
    }
    await conversation.save();
  }

  return conversation;
}
