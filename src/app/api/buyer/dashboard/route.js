import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerProfile from "@/lib/models/BuyerProfile";
import BuyerSaved from "@/lib/models/BuyerSaved";
import BuyerInquiry from "@/lib/models/BuyerInquiry";
import SiteVisit from "@/lib/models/SiteVisit";
import BuyerApplication from "@/lib/models/BuyerApplication";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const profile = await BuyerProfile.findOne({ userId: user._id }).lean();

  const [savedCount, inquiryCount, openInquiries, siteVisitCount, applicationCount] =
    await Promise.all([
      BuyerSaved.countDocuments({ buyerId: user._id }),
      BuyerInquiry.countDocuments({ buyerId: user._id }),
      BuyerInquiry.countDocuments({ buyerId: user._id, status: { $in: ["New", "Open"] } }),
      SiteVisit.countDocuments({ buyerId: user._id }),
      BuyerApplication.countDocuments({ buyerId: user._id }),
    ]);

  const applications = await BuyerApplication.find({ buyerId: user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("projectId", "name")
    .lean();

  const siteVisits = await SiteVisit.find({ buyerId: user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("projectId", "name")
    .lean();

  const saved = await BuyerSaved.find({ buyerId: user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("projectId")
    .populate("unitId")
    .populate("landId")
    .lean();

  return ok({
    profile,
    analytics: {
      savedCount,
      inquiryCount,
      openInquiries,
      siteVisitCount,
      applicationCount,
    },
    applications,
    siteVisits,
    saved,
  });
});
