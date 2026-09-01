import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import Order from "@/lib/models/Order";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);

  const orders = await Order.find({ supplierProfileId: profile._id })
    .sort({ createdAt: -1 })
    .populate("builderId", "name")
    .populate("projectId", "name")
    .lean();

  return ok({ orders, profile });
});
