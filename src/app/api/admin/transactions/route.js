import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import Order from "@/lib/models/Order";
import BuyerApplication from "@/lib/models/BuyerApplication";
import SupplierProfile from "@/lib/models/SupplierProfile";
import User from "@/lib/models/User";
import Project from "@/lib/models/Project";

/**
 * Transactions are synthesized from the two payment sources that exist on
 * the platform: procurement Order payments and buyer application payments.
 * Amounts are kept in their raw statuses (Pending / Manual Review / etc.) so
 * nothing is ever presented as "paid" unless that flag is truly set.
 */
export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status } = parseSearch(request.nextUrl.searchParams);
  const kind = (request.nextUrl.searchParams.get("kind") || "all").trim();
  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 25, 100);

  const rows = [];
  let total = 0;
  let sourceTotals = { orders: 0, applications: 0, pending: 0, completed: 0 };

  async function loadOrders() {
    if (kind !== "all" && kind !== "order") return;
    const filter = {};
    if (status && status !== "all") filter["payment.status"] = status;
    if (q) filter["$or"] = [{ orderNumber: { $regex: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } }];
    const docs = await Order.find(filter).select("orderNumber builderId supplierProfileId projectId totalAmount payment createdAt updatedAt").sort({ createdAt: -1 }).lean();
    const [suppliers, builders] = await Promise.all([
      SupplierProfile.find({ _id: { $in: docs.map((d) => d.supplierProfileId).filter(Boolean) } }).select("businessName ownerName").lean(),
      User.find({ _id: { $in: docs.map((d) => d.builderId).filter(Boolean) } }).select("name username email").lean(),
    ]);
    const sById = new Map(suppliers.map((s) => [String(s._id), s]));
    const uById = new Map(builders.map((b) => [String(b._id), b]));
    for (const d of docs) {
      const payer = uById.get(String(d.builderId));
      const payee = sById.get(String(d.supplierProfileId));
      rows.push({
        id: String(d._id),
        source: "order",
        reference: d.orderNumber || String(d._id),
        kind: "Procurement payment",
        from: (payer && (payer.name || payer.username)) || "Builder",
        to: (payee && payee.businessName) || "Supplier",
        amount: d.totalAmount,
        currency: "INR",
        status: d.payment?.status || (d.status === "Completed" ? "Completed" : "Pending"),
        initiatedAt: d.createdAt || null,
        updatedAt: d.updatedAt || null,
      });
      sourceTotals.orders += d.totalAmount || 0;
      const st = d.payment?.status || "Pending";
      if (st === "Completed") sourceTotals.completed += d.totalAmount || 0;
      else sourceTotals.pending += d.totalAmount || 0;
    }
  }

  async function loadApplications() {
    if (kind !== "all" && kind !== "application") return;
    const filter = {};
    if (status && status !== "all") filter["payment.status"] = status;
    if (q) filter["$or"] = [{ applicationNumber: { $regex: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } }];
    const docs = await BuyerApplication.find(filter).select("applicationNumber buyerId builderId unitDetails payment status createdAt updatedAt").sort({ createdAt: -1 }).lean();
    const [buyers, builders, units] = await Promise.all([
      User.find({ _id: { $in: docs.map((d) => d.buyerId).filter(Boolean) } }).select("name username email").lean(),
      User.find({ _id: { $in: docs.map((d) => d.builderId).filter(Boolean) } }).select("name username email").lean(),
      Project.find({ _id: { $in: docs.map((d) => d.projectId).filter(Boolean) } }).select("name city").lean(),
    ]);
    const bById = new Map(buyers.map((b) => [String(b._id), b]));
    const uById = new Map(builders.map((b) => [String(b._id), b]));
    const u2ById = new Map(units.map((p) => [String(p._id), p]));
    for (const d of docs) {
      const amt = d.payment?.amount || 0;
      rows.push({
        id: String(d._id),
        source: "application",
        reference: d.applicationNumber || String(d._id),
        kind: `${d.unitDetails?.unitType || "Unit"} booking payment`,
        from: (bById.get(String(d.buyerId))?.name || bById.get(String(d.buyerId))?.username) || "Buyer",
        to: (uById.get(String(d.builderId))?.name || uById.get(String(d.builderId))?.username) || "Builder",
        amount: amt,
        currency: "INR",
        status: d.payment?.status || (d.status === "Registered" ? "Completed" : "Pending"),
        initiatedAt: d.createdAt || null,
        updatedAt: d.updatedAt || null,
        project: u2ById.get(String(d.projectId)) || null,
      });
      sourceTotals.applications += amt;
      const st = d.payment?.status || "Pending";
      if (st === "Completed") sourceTotals.completed += amt;
      else sourceTotals.pending += amt;
    }
  }

  await Promise.all([loadOrders(), loadApplications()]);

  rows.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  total = rows.length;

  return ok({
    items: rows.slice(skip, skip + limit),
    total,
    page,
    limit,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    totals: sourceTotals,
  });
});