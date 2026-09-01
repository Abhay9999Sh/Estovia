import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerInquiry from "@/lib/models/BuyerInquiry";
import SiteVisit from "@/lib/models/SiteVisit";
import BuyerApplication from "@/lib/models/BuyerApplication";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const [inquiries, siteVisits, applications] = await Promise.all([
    BuyerInquiry.find({ builderId: user._id })
      .sort({ createdAt: -1 })
      .populate("buyerId", "name avatar")
      .populate("projectId", "name")
      .populate("unitId", "unitNumber unitType")
      .lean(),
    SiteVisit.find({ builderId: user._id })
      .sort({ createdAt: -1 })
      .populate("buyerId", "name avatar")
      .populate("projectId", "name")
      .populate("unitId", "unitNumber unitType")
      .lean(),
    BuyerApplication.find({ builderId: user._id })
      .sort({ createdAt: -1 })
      .populate("buyerId", "name avatar")
      .populate("projectId", "name")
      .populate("unitId", "unitNumber unitType")
      .lean(),
  ]);

  const counts = {
    newInquiries: inquiries.filter((i) => i.status === "New").length,
    openInquiries: inquiries.filter((i) => ["New", "Open"].includes(i.status)).length,
    requestedVisits: siteVisits.filter((v) => v.status === "Requested").length,
    pendingApplications: applications.filter((a) => a.builderApproval.status === "Pending").length,
    activeApplications: applications.filter((a) => !["Cancelled", "Rejected", "Registered", "Closed"].includes(a.status)).length,
  };

  return ok({ inquiries, siteVisits, applications, counts });
});
