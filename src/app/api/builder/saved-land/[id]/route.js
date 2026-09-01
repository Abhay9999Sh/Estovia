import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import SavedLand from "@/lib/models/SavedLand";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Invalid listing.", 400);

  await connectDB();
  const deleted = await SavedLand.findOneAndDelete({ userId: user._id, landId: id });
  if (!deleted) return fail("Not saved.", 404);

  return ok({ saved: false, message: "Removed from saved land." });
});
