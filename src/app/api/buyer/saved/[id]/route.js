import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerSaved from "@/lib/models/BuyerSaved";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Saved item not found.", 400);
  await connectDB();
  const saved = await BuyerSaved.findOneAndDelete({ _id: id, buyerId: user._id });
  if (!saved) return fail("Saved item not found.", 404);
  return ok({ message: "Removed from saved." });
});
