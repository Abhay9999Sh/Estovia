import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import User from "@/lib/models/User";
import LandListing from "@/lib/models/LandListing";
import Project from "@/lib/models/Project";
import Order from "@/lib/models/Order";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import Quotation from "@/lib/models/Quotation";
import BuyerApplication from "@/lib/models/BuyerApplication";
import SupplierProduct from "@/lib/models/SupplierProduct";
import Report from "@/lib/models/Report";
import Interest from "@/lib/models/Interest";
import Proposal from "@/lib/models/Proposal";
import SiteVisit from "@/lib/models/SiteVisit";

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  await connectDB();

  const [
    signupsByDay,
    signupsByMonth,
    usersByRole,
    landsByDate,
    projectsByDate,
    ordersByStatus,
    applicationsByStatus,
    bidsByStatus,
    interestsByStatus,
    proposalsByStatus,
    visitsByStatus,
    reqByStatus,
    topCategories,
    avgLandPrice,
    reportByStatus,
    totals,
  ] = await Promise.all([
    User.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 60 },
    ]),
    User.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([{ $unwind: "$roles" }, { $group: { _id: "$roles", count: { $sum: 1 } } }]),
    LandListing.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 60 },
    ]),
    Project.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 60 },
    ]),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$totalAmount" } } }]),
    BuyerApplication.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Quotation.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Interest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Proposal.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    SiteVisit.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    SupplierRequirement.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    SupplierProduct.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    LandListing.aggregate([{ $match: { "pricing.amount": { $gt: 0 } } }, { $group: { _id: null, avg: { $avg: "$pricing.amount" }, sum: { $sum: "$pricing.amount" } } }]),
    Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Promise.resolve({
      users: await User.countDocuments(),
      lands: await LandListing.countDocuments(),
      projects: await Project.countDocuments(),
      orders: await Order.countDocuments(),
      quotations: await Quotation.countDocuments(),
      applications: await BuyerApplication.countDocuments(),
    }),
  ]);

  return ok({
    signupsByDay,
    signupsByMonth,
    usersByRole,
    landsByDate,
    projectsByDate,
    ordersByStatus,
    applicationsByStatus,
    bidsByStatus,
    interestsByStatus,
    proposalsByStatus,
    visitsByStatus,
    reqByStatus,
    topCategories,
    avgLandPrice: avgLandPrice[0] || { avg: 0, sum: 0 },
    reportByStatus,
    totals,
  });
});