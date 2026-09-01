import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import SupplierProduct from "@/lib/models/SupplierProduct";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const PUT = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Product not found.", 400);
  const body = await request.json();
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);

  const product = await SupplierProduct.findOne({ _id: id, supplierId: profile._id });
  if (!product) return fail("Product not found.", 404);

  const fields = ["name", "category", "subcategory", "description", "unit", "brand", "specifications"];
  for (const f of fields) {
    if (body[f] !== undefined) product[f] = sanitizeText(body[f], f === "description" || f === "specifications" ? 2000 : 200);
  }
  if (body.pricePerUnit !== undefined) product.pricePerUnit = Math.max(0, Number(body.pricePerUnit) || 0);
  if (body.discountPercent !== undefined) product.discountPercent = Math.min(100, Math.max(0, Number(body.discountPercent) || 0));
  if (body.moq !== undefined) product.moq = Math.max(0, Number(body.moq) || 0);
  if (body.availableQuantity !== undefined) product.availableQuantity = Math.max(0, Number(body.availableQuantity) || 0);
  if (body.leadTimeDays !== undefined) product.leadTimeDays = Math.max(0, Number(body.leadTimeDays) || 0);
  if (body.isActive !== undefined) product.isActive = !!body.isActive;
  if (Array.isArray(body.images)) product.images = body.images.map((u) => sanitizeText(u, 500)).filter(Boolean);

  await product.save();
  return ok({ product: product.toObject(), message: "Product updated." });
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Product not found.", 400);
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);
  const product = await SupplierProduct.findOneAndDelete({ _id: id, supplierId: profile._id });
  if (!product) return fail("Product not found.", 404);
  return ok({ message: "Product deleted." });
});
