import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Order from "@/lib/models/Order";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const status = url.searchParams.get("status") || "";

  await connectDB();

  const filter = { builderId: user._id };
  if (projectId) filter.projectId = projectId;
  if (status) filter.status = status;

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .populate("supplierProfileId", "businessName logo phone")
    .populate("projectId", "name")
    .populate("quotationId", "validUntil paymentTerms")
    .lean();

  return ok({ orders });
});