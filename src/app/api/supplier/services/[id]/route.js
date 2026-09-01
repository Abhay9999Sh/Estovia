import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import SupplierService from "@/lib/models/SupplierService";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const PRICING_MODELS = ["Per Project", "Per Sq Ft", "Per Day", "Hourly", "Fixed", "Negotiable", ""];

export const PUT = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Service not found.", 400);
  const body = await request.json();
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);

  const service = await SupplierService.findOne({ _id: id, supplierId: profile._id });
  if (!service) return fail("Service not found.", 404);

  const fields = ["name", "category", "description", "equipmentDetails"];
  for (const f of fields) {
    if (body[f] !== undefined) service[f] = sanitizeText(body[f], f === "description" || f === "equipmentDetails" ? 2000 : 200);
  }
  if (body.pricingModel !== undefined) service.pricingModel = PRICING_MODELS.includes(body.pricingModel) ? body.pricingModel : "";
  if (body.price !== undefined) service.price = Math.max(0, Number(body.price) || 0);
  if (body.turnaroundDays !== undefined) service.turnaroundDays = Math.max(0, Number(body.turnaroundDays) || 0);
  if (Array.isArray(body.serviceableStates)) service.serviceableStates = body.serviceableStates.map((s) => sanitizeText(s, 80)).filter(Boolean);
  if (Array.isArray(body.serviceableCities)) service.serviceableCities = body.serviceableCities.map((s) => sanitizeText(s, 80)).filter(Boolean);
  if (Array.isArray(body.portfolioImages)) service.portfolioImages = body.portfolioImages.map((u) => sanitizeText(u, 500)).filter(Boolean);
  if (body.isActive !== undefined) service.isActive = !!body.isActive;

  await service.save();
  return ok({ service: service.toObject(), message: "Service updated." });
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Service not found.", 400);
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);
  const service = await SupplierService.findOneAndDelete({ _id: id, supplierId: profile._id });
  if (!service) return fail("Service not found.", 404);
  return ok({ message: "Service deleted." });
});
