import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import SupplierProduct from "@/lib/models/SupplierProduct";
import SupplierService from "@/lib/models/SupplierService";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const category = url.searchParams.get("category") || "";

  await connectDB();

  const filter = { onboardingComplete: true };
  if (category) filter.category = category;
  if (q) {
    filter.$or = [
      { businessName: { $regex: q, $options: "i" } },
      { subcategories: { $regex: q, $options: "i" } },
      { productCategories: { $regex: q, $options: "i" } },
      { serviceCategories: { $regex: q, $options: "i" } },
    ];
  }

  const suppliers = await SupplierProfile.find(filter)
    .select(
      "_id businessName category logo bio rating reviewCount orderCount operatingLocations serviceableStates verification onboardingComplete"
    )
    .sort({ rating: -1 })
    .limit(50)
    .lean();

  // Annotate each supplier with a small product/service preview.
  const supplierIds = suppliers.map((s) => s._id);
  const products = await SupplierProduct.find({
    supplierId: { $in: supplierIds },
    isActive: true,
  })
    .select("supplierId name category pricePerUnit unit")
    .limit(200)
    .lean();
  const services = await SupplierService.find({
    supplierId: { $in: supplierIds },
    isActive: true,
  })
    .select("supplierId name category price pricingModel")
    .limit(200)
    .lean();

  const productMap = {};
  const serviceMap = {};
  for (const p of products) {
    (productMap[String(p.supplierId)] = productMap[String(p.supplierId)] || []).push(p);
  }
  for (const s of services) {
    (serviceMap[String(s.supplierId)] = serviceMap[String(s.supplierId)] || []).push(s);
  }

  const result = suppliers.map((s) => ({
    ...s,
    products: (productMap[String(s._id)] || []).slice(0, 4),
    services: (serviceMap[String(s._id)] || []).slice(0, 4),
  }));

  return ok({ suppliers: result });
});
