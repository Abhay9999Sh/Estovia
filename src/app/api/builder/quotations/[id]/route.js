import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Quotation from "@/lib/models/Quotation";
import SupplierProfile from "@/lib/models/SupplierProfile";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Quotation not found.", 400);
  await connectDB();
  const quotation = await Quotation.findById(id)
    .populate("supplierProfileId", "businessName logo")
    .populate("requirementId", "title")
    .populate("projectId", "name")
    .lean();
  if (!quotation) return fail("Quotation not found.", 404);
  const profile = await SupplierProfile.findOne({ userId: user._id }).lean();
  const isBuilder = quotation.builderId && String(quotation.builderId) === String(user._id);
  const isSupplier = profile && quotation.supplierProfileId && String(quotation.supplierProfileId._id) === String(profile._id);
  if (!isBuilder && !isSupplier) {
    return fail("You are not authorized to view this quotation.", 403);
  }
  return ok({ quotation });
});

// POST { action: "counter" } - builder makes a counter offer (immutable history)
export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Quotation not found.", 400);
  const body = await request.json();

  await connectDB();
  const quotation = await Quotation.findOne({ _id: id, builderId: user._id });
  if (!quotation) return fail("Quotation not found.", 404);

  if (body.action !== "counter") return fail("Invalid action.", 400);
  if (!["Pending", "Received", "Under Review", "Negotiation"].includes(quotation.status)) {
    return fail("This quotation cannot be countered.", 400);
  }

  quotation.revisionHistory.push({
    revision: quotation.revision,
    from: "builder",
    subtotal: quotation.subtotal,
    totalAmount: quotation.totalAmount,
    note: sanitizeText(body.note, 500),
    createdAt: new Date(),
  });

  const target = Number(body.targetAmount);
  if (!target || target <= 0) return fail("Provide a valid target amount.", 400);

  // For a builder counter, keep line items but apply a single target amount
  // distributed proportionally (represents negotiated total).
  quotation.totalAmount = Math.round(target * 100) / 100;
  quotation.revision = (quotation.revision || 1) + 1;
  if (body.validUntil) quotation.validUntil = new Date(body.validUntil);
  if (body.notes !== undefined) quotation.notes = sanitizeText(body.notes, 2000);
  quotation.status = "Negotiation";
  quotation.isCounterOffer = true;
  await quotation.save();

  const supplierProfile = await SupplierProfile.findOne({ _id: quotation.supplierProfileId });
  const supplierUser = supplierProfile?.userId;

  if (supplierUser) {
    await createNotification({
      userId: supplierUser,
      type: "quotation_countered",
      title: "Counter offer received",
      message: `The builder sent a counter offer of ${formatInr(target)}.`,
      entityType: "quotation",
      entityId: quotation._id,
      link: "/supplier/quotations",
      metadata: { quotationId: quotation._id },
    });
  }

  return ok({ quotation: quotation.toObject(), message: "Counter offer sent." });
});

function formatInr(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}
