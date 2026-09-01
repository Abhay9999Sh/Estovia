import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import Quotation from "@/lib/models/Quotation";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request, ctx) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Requirement not found.", 400);
  await connectDB();
  const requirement = await SupplierRequirement.findOne({ _id: id })
    .populate("builderId", "name")
    .populate("projectId", "name")
    .populate("invitedSupplierIds", "businessName logo")
    .populate("selectedSupplierId", "businessName logo")
    .lean();
  if (!requirement) return fail("Requirement not found.", 404);

  const quotations = await Quotation.find({ requirementId: id })
    .sort({ createdAt: 1 })
    .populate("supplierProfileId", "businessName logo rating orderCount")
    .lean();

  return ok({ requirement, quotations });
});

export const PUT = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Requirement not found.", 400);
  const body = await request.json();
  await connectDB();
  const requirement = await SupplierRequirement.findOne({ _id: id, builderId: user._id });
  if (!requirement) return fail("Requirement not found.", 404);
  if (requirement.status !== "Draft" && requirement.status !== "Open") {
    return fail("This requirement cannot be edited.", 400);
  }

  if (body.title !== undefined) requirement.title = sanitizeText(body.title, 200);
  if (body.category !== undefined) requirement.category = sanitizeText(body.category, 120);
  if (body.description !== undefined) requirement.description = sanitizeText(body.description, 2000);
  if (body.estimatedValue !== undefined) requirement.estimatedValue = Math.max(0, Number(body.estimatedValue) || 0);
  if (body.deliveryLocation !== undefined) requirement.deliveryLocation = sanitizeText(body.deliveryLocation, 500);
  if (body.requiredBy) requirement.requiredBy = new Date(body.requiredBy);
  if (body.validUntil) requirement.validUntil = new Date(body.validUntil);
  if (Array.isArray(body.lineItems)) {
    requirement.lineItems = body.lineItems.slice(0, 200).map((l) => ({
      item: sanitizeText(l.item, 200),
      quantity: Math.max(0, Number(l.quantity) || 0),
      unit: sanitizeText(l.unit, 40),
      specification: sanitizeText(l.specification, 1000),
    }));
  }

  await requirement.save();
  return ok({ requirement: requirement.toObject(), message: "Requirement updated." });
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Requirement not found.", 400);
  await connectDB();
  const requirement = await SupplierRequirement.findOneAndDelete({ _id: id, builderId: user._id });
  if (!requirement) return fail("Requirement not found.", 404);
  return ok({ message: "Requirement deleted." });
});
