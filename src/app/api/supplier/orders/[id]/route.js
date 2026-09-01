import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import Order from "@/lib/models/Order";
import User from "@/lib/models/User";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Order not found.", 400);
  await connectDB();
  const order = await Order.findById(id)
    .populate("builderId", "name avatar")
    .populate("projectId", "name")
    .populate("quotationId")
    .lean();
  if (!order) return fail("Order not found.", 404);
  const profile = await SupplierProfile.findOne({ userId: user._id }).lean();
  const isSupplier = profile && String(order.supplierProfileId) === String(profile._id);
  const isBuilder = String(order.builderId) === String(user._id);
  if (!isSupplier && !isBuilder) {
    return fail("You are not authorized to view this order.", 403);
  }
  return ok({ order });
});

const SUPPLIER_ALLOWED_STATES = {
  // from -> allowed next states [status, message]
  Pending: [["Confirmed", "Order accepted"], ["Cancelled", "Order declined"]],
  Confirmed: [["In Production", "Started production"], ["Cancelled", "Cancelled order"]],
  "In Production": [["In Transit", "Shipped"], ["Delivered", "Delivered"], ["Disputed", "Disputed order"]],
  "In Transit": [["Delivered", "Marked delivered"], ["Disputed", "Disputed order"]],
  Delivered: [["Completed", "Marked completed"]],
  "Partially Delivered": [["Delivered", "Marked delivered"], ["Delivered", "Marked delivered"], ["Completed", "Marked completed"]],
};

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Order not found.", 400);
  const body = await request.json();
  const action = body.action;

  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);

  const order = await Order.findOne({ _id: id, supplierProfileId: profile._id });
  if (!order) return fail("Order not found.", 404);

  if (action === "confirm") {
    if (order.status !== "Pending") return fail("Order is not pending.", 400);
    order.status = "Confirmed";
    order.payment.status = "Manual Review";
    await order.save();
    await notifyBuilder(order, "Order confirmed", `${profile.businessName || "Supplier"} accepted the order.`);
    return ok({ order: order.toObject(), message: "Order confirmed." });
  }

  if (action === "updateStatus") {
    const next = body.status;
    let allowed = false;
    for (const [to] of SUPPLIER_ALLOWED_STATES[order.status] || []) {
      if (to === next) {
        allowed = true;
        break;
      }
    }
    if (!allowed) return fail(`Cannot change status from "${order.status}" to "${next}".`, 400);
    order.status = next;
    if (next === "Delivered") order.actualDelivery = new Date();
    if (next === "Completed") order.payment.status = "Manual Review";
    await order.save();
    await notifyBuilder(order, "Order status updated", `Order ${order.orderNumber} is now "${next}".`);
    return ok({ order: order.toObject(), message: `Order status updated to "${next}".` });
  }

  if (action === "milestone") {
    const index = Number(body.index);
    if (!Array.isArray(order.milestones) || !order.milestones[index]) {
      return fail("Milestone not found.", 400);
    }
    const ms = order.milestones[index];
    ms.status = body.milestoneStatus || "Completed";
    if (ms.status === "Completed") ms.completedAt = new Date();
    await order.save();
    return ok({ order: order.toObject(), message: "Milestone updated." });
  }

  if (action === "cancel") {
    if (!["Pending", "Confirmed"].includes(order.status)) {
      return fail("This order cannot be cancelled at this stage.", 400);
    }
    const reason = sanitizeText(body.reason, 500);
    order.status = "Cancelled";
    order.cancellationReason = reason;
    await order.save();
    await notifyBuilder(order, "Order cancelled", `Order ${order.orderNumber} was cancelled.`);
    return ok({ order: order.toObject(), message: "Order cancelled." });
  }

  if (action === "dispute") {
    order.status = "Disputed";
    order.disputeNote = sanitizeText(body.note, 2000);
    await order.save();
    await notifyBuilder(order, "Order disputed", `Order ${order.orderNumber} was marked as disputed.`);
    return ok({ order: order.toObject(), message: "Order marked as disputed." });
  }

  return fail("Invalid action.", 400);
});

async function notifyBuilder(order, title, message) {
  await createNotification({
    userId: order.builderId,
    type: "order_update",
    title,
    message,
    entityType: "order",
    entityId: order._id,
    link: "/builder/orders",
    metadata: { orderId: order._id },
  });
}
