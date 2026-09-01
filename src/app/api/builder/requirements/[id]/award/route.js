import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import Quotation from "@/lib/models/Quotation";
import Order from "@/lib/models/Order";
import SupplierProfile from "@/lib/models/SupplierProfile";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { findOrCreateConversation } from "@/lib/dialog";

// POST { quotationId, awardNote } - select a supplier's quotation and create
// an order. Required server-side: the builder owns the requirement and the
// quotation belongs to that requirement.
export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Requirement not found.", 400);
  const body = await request.json();

  await connectDB();
  const requirement = await SupplierRequirement.findOne({ _id: id, builderId: user._id });
  if (!requirement) return fail("Requirement not found.", 404);
  if (!mongoose.isValidObjectId(body.quotationId)) return fail("Invalid quotation.", 400);

  const quotation = await Quotation.findOne({
    _id: body.quotationId,
    requirementId: requirement._id,
  });
  if (!quotation) return fail("Quotation not found for this requirement.", 404);

  // Create the order from the accepted quotation.
  const orderNumber = "ORD-" + Date.now().toString(36).toUpperCase();
  const order = await Order.create({
    orderNumber,
    builderId: user._id,
    supplierProfileId: quotation.supplierProfileId,
    requirementId: requirement._id,
    projectId: quotation.projectId || requirement.projectId,
    quotationId: quotation._id,
    lines: quotation.lineItems || [],
    subtotal: quotation.subtotal || 0,
    taxes: quotation.taxes?.gstAmount || 0,
    deliveryCharges: quotation.transportCharges || 0,
    totalAmount: quotation.totalAmount || 0,
    status: "Pending",
    payment: { amount: quotation.totalAmount || 0, status: "Manual Review", method: "", reference: "" },
    deliveryAddress: sanitizeText(body.deliveryAddress, 500) || requirement.deliveryLocation,
    expectedDelivery: body.expectedDelivery ? new Date(body.expectedDelivery) : quotation.validUntil,
    terms: sanitizeText(body.terms, 2000),
  });

  quotation.status = "Accepted";
  await quotation.save();

  requirement.status = "Order Placed";
  requirement.selectedSupplierId = quotation.supplierProfileId;
  requirement.selectedQuotationId = quotation._id;
  requirement.awardNote = sanitizeText(body.awardNote, 1000);
  requirement.closedAt = new Date();
  await requirement.save();

  const supplierProfile = await SupplierProfile.findOne({ _id: quotation.supplierProfileId });
  const supplierUser = supplierProfile?.userId;

  if (supplierUser) {
    await findOrCreateConversation({
      context: "builder_supplier",
      participantIds: [user._id, supplierUser],
      extra: {
        builderId: user._id,
        supplierId: supplierUser,
        supplierProfileId: quotation.supplierProfileId,
        projectId: requirement.projectId || null,
        requirementId: requirement._id,
        quotationId: quotation._id,
        orderId: order._id,
      },
    });
    await createNotification({
      userId: supplierUser,
      type: "order_placed",
      title: "New order",
      message: `Your quotation for "${requirement.title}" was accepted. Order ${orderNumber} created.`,
      entityType: "order",
      entityId: order._id,
      link: "/supplier/orders",
      metadata: { orderId: order._id, requirementId: requirement._id },
    });
  }

  return ok({ order, message: "Order created and supplier notified." }, 201);
});
