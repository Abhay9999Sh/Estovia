import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import Quotation from "@/lib/models/Quotation";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const category = url.searchParams.get("category") || "";

  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id }).lean();

  const filter = { status: "Open" };
  if (category) filter.category = category;

  // If the supplier's profile exists, they may see requirements they were
  // invited to even if not public. Otherwise only public requirements.
  filter.visibility = "public";
  if (profile) {
    filter.$or = [
      { visibility: "public" },
      { visibility: "private", invitedSupplierIds: profile._id },
    ];
  }

  if (q) {
    filter.title = { $regex: q, $options: "i" };
  }

  const requirements = await SupplierRequirement.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("builderId", "name companyName")
    .populate("projectId", "name location")
    .lean();

  // Mark which requirements this supplier has already quoted.
  const requirementIds = requirements.map((r) => r._id);
  let quotedMap = {};
  if (profile && requirementIds.length) {
    const quotes = await Quotation.find({
      requirementId: { $in: requirementIds },
      supplierProfileId: profile._id,
    })
      .select("requirementId status")
      .lean();
    quotedMap = quotes.reduce((acc, q) => {
      acc[String(q.requirementId)] = q.status;
      return acc;
    }, {});
  }

  return ok({ requirements, quotedMap, profile: profile || null });
});
