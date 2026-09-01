import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import Quotation from "@/lib/models/Quotation";
import User from "@/lib/models/User";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { findOrCreateConversation } from "@/lib/dialog";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Requirement not found.", 400);
  await connectDB();
  const requirement = await SupplierRequirement.findById(id)
    .populate("builderId", "name")
    .populate("projectId", "name location")
    .populate("invitedSupplierIds", "businessName logo")
    .lean();
  if (!requirement) return fail("Requirement not found.", 404);
  const builderId = requirement.builderId?._id || requirement.builderId;
  const isBuilder = String(builderId) === String(user._id);
  if (requirement.visibility === "private" && !isBuilder) {
    const profile = await SupplierProfile.findOne({ userId: user._id }).lean();
    const invited = (requirement.invitedSupplierIds || []).map((s) => String(s?._id || s));
    const isInvited = profile && invited.includes(String(profile._id));
    if (!isInvited) {
      return fail("You are not authorized to view this requirement.", 403);
    }
  }
  return ok({ requirement });
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Requirement not found.", 400);
  const body = await request.json();

  await connectDB();
  const profile = await SupplierProfile.findOne({ userId: user._id });
  if (!profile) return fail("Complete your supplier profile first.", 400);

  const requirement = await SupplierRequirement.findById(id);
  if (!requirement) return fail("Requirement not found.", 404);
  if (requirement.status !== "Open") {
    return fail("This requirement is no longer accepting quotations.", 400);
  }
  if (requirement.visibility === "private") {
    const invited = (requirement.invitedSupplierIds || []).map((s) => String(s));
    if (!invited.includes(String(profile._id))) {
      return fail("You are not invited to quote on this requirement.", 403);
    }
  }

  // A supplier may only have one active quotation per requirement.
  const existing = await Quotation.findOne({
    requirementId: id,
    supplierProfileId: profile._id,
    status: { $nin: ["Withdrawn", "Declined", "Expired"] },
  });
  if (existing) {
    return fail("You already have a quotation on this requirement.", 400);
  }

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
    : [];
  if (!lines.length) return fail("Please provide at least one line item.", 400);

  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const gstRate = Math.min(100, Math.max(0, Number(body.gstRate) || 0));
  const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
  const otherTaxes = Math.max(0, Number(body.otherTaxes) || 0);
  const transportCharges = Math.max(0, Number(body.transportCharges) || 0);
  const totalAmount = Math.round((subtotal + gstAmount + otherTaxes + transportCharges) * 100) / 100;

  const quotation = await Quotation.create({
    requirementId: id,
    projectId: requirement.projectId || null,
    supplierProfileId: profile._id,
    builderId: requirement.builderId,
    lineItems: lines,
    subtotal,
    taxes: { gstRate, gstAmount, otherTaxes },
    transportCharges,
    totalAmount,
    validUntil: body.validUntil ? new Date(body.validUntil) : null,
    leadTimeDays: Math.max(0, Number(body.leadTimeDays) || 0),
    paymentTerms: sanitizeText(body.paymentTerms, 2000),
    notes: sanitizeText(body.notes, 2000),
    status: "Submitted",
    isCounterOffer: false,
    revision: 1,
    revisionHistory: [
      {
        revision: 0,
        from: "supplier",
        subtotal: 0,
        totalAmount: 0,
        note: "Initial quotation draft",
      },
    ],
  });

  requirement.status = "Responses Received";
  await requirement.save();

  // Optionally open a conversation channel with the builder.
  if (body.openConversation) {
    await findOrCreateConversation({
      context: "builder_supplier",
      participantIds: [user._id, requirement.builderId],
      extra: {
        supplierId: user._id,
        supplierProfileId: profile._id,
        builderId: requirement.builderId,
        projectId: requirement.projectId || null,
        requirementId: requirement._id,
        quotationId: quotation._id,
      },
    });
  }

  await createNotification({
    userId: requirement.builderId,
    type: "quotation_received",
    title: "New quotation received",
    message: `${profile.businessName || "A supplier"} submitted a quotation for "${requirement.title}".`,
    entityType: "quotation",
    entityId: quotation._id,
    link: "/builder/quotations",
    metadata: { requirementId: requirement._id, quotationId: quotation._id },
  });

  return ok({ quotation, message: "Quotation submitted." }, 201);
});
