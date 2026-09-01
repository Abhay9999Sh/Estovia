import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import SupplierService from "@/lib/models/SupplierService";
import { ok, fail, sanitizeText, validateRequired } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const PRICING_MODELS = ["Per Project", "Per Sq Ft", "Per Day", "Hourly", "Fixed", "Negotiable", ""];

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);
  const services = await SupplierService.find({ supplierId: profile._id })
    .sort({ createdAt: -1 })
    .lean();
  return ok({ services });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);

  const missing = validateRequired(body, ["name"]);
  if (missing) return fail(`${missing} is required.`);

  const service = await SupplierService.create({
    supplierId: profile._id,
    name: sanitizeText(body.name, 200),
    category: sanitizeText(body.category, 120),
    description: sanitizeText(body.description, 2000),
    pricingModel: PRICING_MODELS.includes(body.pricingModel) ? body.pricingModel : "",
    price: Math.max(0, Number(body.price) || 0),
    serviceableStates: Array.isArray(body.serviceableStates)
      ? body.serviceableStates.map((s) => sanitizeText(s, 80)).filter(Boolean)
      : [],
    serviceableCities: Array.isArray(body.serviceableCities)
      ? body.serviceableCities.map((s) => sanitizeText(s, 80)).filter(Boolean)
      : [],
    turnaroundDays: Math.max(0, Number(body.turnaroundDays) || 0),
    portfolioImages: Array.isArray(body.portfolioImages)
      ? body.portfolioImages.map((u) => sanitizeText(u, 500)).filter(Boolean)
      : [],
    equipmentDetails: sanitizeText(body.equipmentDetails, 2000),
    isActive: body.isActive !== false,
  });

  return ok({ service, message: "Service added." }, 201);
});
