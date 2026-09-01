import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import Quotation from "@/lib/models/Quotation";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import User from "@/lib/models/User";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Quotation not found.", 400);
  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Supplier profile not found.", 404);
  const quotation = await Quotation.findOne({ _id: id, supplierProfileId: profile._id })
    .populate("requirementId", "title status")
    .populate("projectId", "name")
    .lean();
  if (!quotation) return fail("Quotation not found.", 404);
  return ok({ quotation });
});

// POST supports { action: "counter" } or { action: "withdraw" }
export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Quotation not found.", 400);
  const body = await request.json();
  const action = body.action;

  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);

  const quotation = await Quotation.findOne({
    _id: id,
    supplierProfileId: profile._id,
  });
  if (!quotation) return fail("Quotation not found.", 404);

  if (action === "withdraw") {
    if (["Accepted", "Declined", "Withdrawn", "Expired"].includes(quotation.status)) {
      return fail("This quotation cannot be withdrawn.", 400);
    }
    quotation.status = "Withdrawn";
    await quotation.save();
    await createNotification({
      userId: quotation.builderId,
      type: "quotation_withdrawn",
      title: "Quotation withdrawn",
      message: `${profile.businessName || "A supplier"} withdrew their quotation.`,
      entityType: "quotation",
      entityId: quotation._id,
      link: "/builder/quotations",
      metadata: { quotationId: quotation._id },
    });
    return ok({ quotation: quotation.toObject(), message: "Quotation withdrawn." });
  }

  if (action === "counter") {
    if (!["Pending", "Received", "Under Review", "Negotiation"].includes(quotation.status)) {
      return fail("This quotation cannot be countered.", 400);
    }
    // Immutable history: push current offer into history before overwriting.
    quotation.revisionHistory.push({
      revision: quotation.revision,
      from: "supplier",
      subtotal: quotation.subtotal,
      totalAmount: quotation.totalAmount,
      note: sanitizeText(body.note, 500),
      createdAt: new Date(),
    });

    const lines = Array.isArray(body.lineItems)
      ? body.lineItems.slice(0, 200).map((l) => {
          const quantity = Number(l.quantity) || 0;
          const unitPrice = Number(l.unitPrice) || 0;
          return {
            item: sanitizeText(l.item, 200),
            quantity,
            unit: sanitizeText(l.unit, 40),
            unitPrice,
            lineTotal: Math.round(quantity * unitPrice * 100) / 100,
          };
        })
      : quotation.lineItems;
    const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
    const gstRate = quotation.taxes?.gstRate || 0;
    const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
    const otherTaxes = quotation.taxes?.otherTaxes || 0;
    const transportCharges = quotation.transportCharges || 0;
    const totalAmount = Math.round((subtotal + gstAmount + otherTaxes + transportCharges) * 100) / 100;

    quotation.lineItems = lines;
    quotation.subtotal = subtotal;
    quotation.taxes = { gstRate, gstAmount, otherTaxes };
    quotation.transportCharges = transportCharges;
    quotation.totalAmount = totalAmount;
    quotation.revision = (quotation.revision || 1) + 1;
    if (body.validUntil) quotation.validUntil = new Date(body.validUntil);
    if (body.leadTimeDays !== undefined) quotation.leadTimeDays = Math.max(0, Number(body.leadTimeDays) || 0);
    if (body.paymentTerms !== undefined) quotation.paymentTerms = sanitizeText(body.paymentTerms, 2000);
    if (body.notes !== undefined) quotation.notes = sanitizeText(body.notes, 2000);
    quotation.status = "Negotiation";
    quotation.isCounterOffer = true;
    await quotation.save();

    await createNotification({
      userId: quotation.builderId,
      type: "quotation_countered",
      title: "Counter offer received",
      message: `${profile.businessName || "A supplier"} sent a counter offer for ${formatInr(totalAmount)}.`,
      entityType: "quotation",
      entityId: quotation._id,
      link: "/builder/quotations",
      metadata: { quotationId: quotation._id },
    });
    return ok({ quotation: quotation.toObject(), message: "Counter offer sent." });
  }

  return fail("Invalid action.", 400);
});

function formatInr(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}
