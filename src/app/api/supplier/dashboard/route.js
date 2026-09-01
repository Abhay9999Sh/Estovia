import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import SupplierProduct from "@/lib/models/SupplierProduct";
import SupplierService from "@/lib/models/SupplierService";
import Quotation from "@/lib/models/Quotation";
import Order from "@/lib/models/Order";
import SupplierRating from "@/lib/models/SupplierRating";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const profile = await SupplierProfile.findOne({ userId: user._id }).lean();
  if (!profile) return ok({ profile: null, analytics: null });

  const [productCount, serviceCount, openQuotations, activeOrders, completedOrders, ratingAgg] =
    await Promise.all([
      SupplierProduct.countDocuments({ supplierId: profile._id }),
      SupplierService.countDocuments({ supplierId: profile._id }),
      Quotation.countDocuments({
        supplierProfileId: profile._id,
        status: { $in: ["Submitted", "Received", "Under Review", "Negotiation"] },
      }),
      Order.countDocuments({
        supplierProfileId: profile._id,
        status: { $in: ["Confirmed", "In Production", "In Transit", "Partially Delivered", "Delivered"] },
      }),
      Order.countDocuments({ supplierProfileId: profile._id, status: "Completed" }),
      SupplierRating.aggregate([
        { $match: { supplierProfileId: profile._id } },
        { $group: { _id: null, avg: { $avg: "$overallRating" }, count: { $sum: 1 } } },
      ]),
    ]);

  const recentOrders = await Order.find({ supplierProfileId: profile._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("projectId", "name")
    .lean();

  const recentQuotations = await Quotation.find({ supplierProfileId: profile._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate({
      path: "requirementId",
      populate: { path: "projectId", select: "name" },
    })
    .lean();

  // Notify-relevant open requirements matching this supplier's categories.
  const openRequirements = await SupplierRequirement.find({
    status: "Open",
    visibility: "public",
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("projectId", "name")
    .populate("builderId", "name")
    .lean();

  const avg = ratingAgg[0];
  const rating = avg ? avg.avg : 0;
  const reviewCount = avg ? avg.count : 0;

  const analytics = {
    productCount,
    serviceCount,
    openQuotations,
    activeOrders,
    completedOrders,
    rating: Math.round(rating * 10) / 10,
    reviewCount,
    totalRevenue: { amount: 0, status: "Manual Review" },
  };

  return ok({
    profile,
    analytics,
    recentOrders,
    recentQuotations,
    openRequirements,
  });
});
