import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import MaterialRequirement from "@/lib/models/MaterialRequirement";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const STATUSES = ["Open", "Quotation Received", "Shortlisted", "Awarded", "Closed"];

export const PATCH = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { mid } = await ctx.params;
  const body = await request.json();
  if (!mongoose.isValidObjectId(mid)) return fail("Requirement not found.", 400);

  await connectDB();
  const requirement = await MaterialRequirement.findById(mid);
  if (!requirement) return fail("Requirement not found.", 404);
  if (String(requirement.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return fail("Invalid status.", 400);
    requirement.status = body.status;
  }
  if (body.material !== undefined) requirement.material = sanitizeText(body.material, 160);
  if (body.quantity !== undefined) requirement.quantity = Math.max(0, Number(body.quantity) || 0);
  if (body.unit !== undefined) requirement.unit = sanitizeText(body.unit, 40);
  if (body.requiredBy !== undefined) requirement.requiredBy = body.requiredBy ? new Date(body.requiredBy) : null;

  await requirement.save();
  return ok({ material: requirement, message: "Requirement updated." });
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { mid } = await ctx.params;
  if (!mongoose.isValidObjectId(mid)) return fail("Requirement not found.", 400);

  await connectDB();
  const requirement = await MaterialRequirement.findById(mid);
  if (!requirement) return fail("Requirement not found.", 404);
  if (String(requirement.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  await MaterialRequirement.deleteOne({ _id: mid });
  return ok({ message: "Requirement removed." });
});
