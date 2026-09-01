import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import SupplierProduct from "@/lib/models/SupplierProduct";
import { ok, fail, sanitizeText, validateRequired } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);

  const products = await SupplierProduct.find({ supplierId: profile._id })
    .sort({ createdAt: -1 })
    .lean();
  return ok({ products });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);

  const missing = validateRequired(body, ["name"]);
  if (missing) return fail(`${missing} is required.`);

  const product = await SupplierProduct.create({
    supplierId: profile._id,
    name: sanitizeText(body.name, 200),
    category: sanitizeText(body.category, 120),
    subcategory: sanitizeText(body.subcategory, 120),
    description: sanitizeText(body.description, 2000),
    unit: sanitizeText(body.unit, 40) || "unit",
    pricePerUnit: Math.max(0, Number(body.pricePerUnit) || 0),
    discountPercent: Math.min(100, Math.max(0, Number(body.discountPercent) || 0)),
    brand: sanitizeText(body.brand, 120),
    specifications: sanitizeText(body.specifications, 2000),
    moq: Math.max(0, Number(body.moq) || 0),
    availableQuantity: Math.max(0, Number(body.availableQuantity) || 0),
    leadTimeDays: Math.max(0, Number(body.leadTimeDays) || 0),
    images: Array.isArray(body.images) ? body.images.map((u) => sanitizeText(u, 500)).filter(Boolean) : [],
    isActive: body.isActive !== false,
  });

  return ok({ product, message: "Product added." }, 201);
});
