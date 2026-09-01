import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Quotation from "@/lib/models/Quotation";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const url = new URL(request.url);
  const requirementId = url.searchParams.get("requirementId") || "";
  const status = url.searchParams.get("status") || "";
  await connectDB();

  const filter = { builderId: user._id };
  if (requirementId) filter.requirementId = requirementId;
  if (status) filter.status = status;

  const quotations = await Quotation.find(filter)
    .sort({ createdAt: -1 })
    .populate("supplierProfileId", "businessName logo rating orderCount")
    .populate({
      path: "requirementId",
      populate: { path: "projectId", select: "name" },
    })
    .lean();

  return ok({ quotations });
});
