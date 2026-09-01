import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import SupplierProfile from "@/lib/models/SupplierProfile";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

// POST { supplierIds: [SupplierProfile ids] } to shortlist suppliers for a
// requirement (moves to "Shortlisted" and notifies the suppliers).
export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Requirement not found.", 400);
  const body = await request.json();

  await connectDB();
  const requirement = await SupplierRequirement.findOne({ _id: id, builderId: user._id });
  if (!requirement) return fail("Requirement not found.", 404);
  if (["Order Placed", "Fulfilled", "Cancelled", "Closed"].includes(requirement.status)) {
    return fail("This requirement is closed.", 400);
  }

  const supplierIds = Array.isArray(body.supplierIds)
    ? body.supplierIds.filter((s) => mongoose.isValidObjectId(s))
    : [];

  if (!body.inviteOnly && !supplierIds.length) {
    return fail("Select at least one supplier to shortlist.", 400);
  }

  if (body.inviteOnly) {
    // Add private invitees (for private requirements)
    requirement.invitedSupplierIds = Array.from(
      new Set([...(requirement.invitedSupplierIds || []), ...supplierIds])
    );
    requirement.visibility = "private";
    await requirement.save();
    return ok({ requirement: requirement.toObject(), message: "Suppliers invited." });
  }

  requirement.status = "Shortlisted";
  await requirement.save();
  return ok({ requirement: requirement.toObject(), message: "Requirement shortlisted." });
});
