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
import Report from "@/lib/models/Report";
import Verification from "@/lib/models/Verification";
import AuditLog from "@/lib/models/AuditLog";

export const GET = withErrorHandling(async () => {
  const adminUser = await requireAdmin();
  await connectDB();

  const [
    userCount,
    landCount,
    projectCount,
    orderCount,
    requirementCount,
    quotationCount,
    applicationCount,
    reportCount,
    verificationCount,
    pendingLands,
    pendingProjects,
    pendingVerifications,
    openReports,
    pendingLandDocs,
    pendingProjectDocs,
    recentLogs,
    recentSignups,
    recentListings,
    recentOrders,
  ] = await Promise.all([
    User.countDocuments(),
    LandListing.countDocuments(),
    Project.countDocuments(),
    Order.countDocuments(),
    SupplierRequirement.countDocuments(),
    Quotation.countDocuments(),
    BuyerApplication.countDocuments(),
    Report.countDocuments(),
    Verification.countDocuments(),
    LandListing.countDocuments({
      $or: [{ verificationStatus: "submitted" }, { verificationStatus: "under_review" }],
    }),
    Project.countDocuments({ status: { $in: ["Planning", "Land Acquisition", "Documentation", "Approvals"] } }),
    Verification.countDocuments({ status: { $in: ["submitted", "under_review", "manual_review"] } }),
    Report.countDocuments({ status: { $in: ["OPEN", "UNDER_REVIEW", "WAITING_FOR_INFORMATION"] } }),
    import("@/lib/models/LandDocument").then(({ default: M }) =>
      M.countDocuments({ status: { $in: ["pending", "submitted"] } })
    ),
    import("@/lib/models/ProjectDocument").then(({ default: M }) =>
      M.countDocuments({ status: { $in: ["uploaded", "under_review"] } })
    ),
    AuditLog.find().sort({ createdAt: -1 }).limit(15).lean(),
    User.find().sort({ createdAt: -1 }).limit(10).select("name username email roles createdAt verification").lean(),
    LandListing.find().sort({ createdAt: -1 }).limit(10).select("title pricing verificationStatus status location reviewedBy reviewedAt createdAt").lean(),
    Order.find().sort({ createdAt: -1 }).limit(10).select("orderNumber totalAmount status payment.amount createdAt").lean(),
  ]);

  const [usersByRole, landsByStatus, ordersByStatus, projectsByStatus, requirementsByStatus] =
    await Promise.all([
      User.aggregate([{ $group: { _id: "$roles", count: { $sum: 1 } } }]),
      LandListing.aggregate([{ $group: { _id: "$verificationStatus", count: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Project.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      SupplierRequirement.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

  return ok({
    stats: {
      users: userCount,
      lands: landCount,
      projects: projectCount,
      orders: orderCount,
      requirements: requirementCount,
      quotations: quotationCount,
      applications: applicationCount,
      reports: reportCount,
      verifications: verificationCount,
      pendingLands,
      pendingProjects,
      pendingVerifications,
      openReports,
      pendingDocuments: pendingLandDocs + pendingProjectDocs,
    },
    breakdown: {
      usersByRole,
      landsByStatus,
      ordersByStatus,
      projectsByStatus,
      requirementsByStatus,
    },
    recent: {
      logs: recentLogs,
      signups: recentSignups,
      listings: recentListings,
      orders: recentOrders,
    },
    generatedBy: String(adminUser._id),
  });
});