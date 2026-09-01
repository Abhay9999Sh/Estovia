import { connectDB } from "@/lib/mongodb";
import { requireAdmin, parsePagination, parseSearch } from "@/lib/admin";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import LandDocument from "@/lib/models/LandDocument";
import ProjectDocument from "@/lib/models/ProjectDocument";
import BuyerApplication from "@/lib/models/BuyerApplication";
import LandownerProfile from "@/lib/models/LandownerProfile";
import User from "@/lib/models/User";

const LAND_TYPES = { sale_deed: "Sale Deed", mutation: "Mutation", land_record: "Land Record", encumbrance: "Encumbrance", tax_receipt: "Tax Receipt", survey_map: "Survey Map", other: "Other" };
const PROJECT_TYPES = { company: "Company", identity: "Identity", gst: "GST", mca: "MCA", rera: "RERA", project: "Project", land: "Land", legal: "Legal", other: "Other" };

const PENDING_LAND = ["pending", "submitted"];
const PENDING_PROJECT = ["uploaded", "under_review"];
const PENDING_APP = ["Pending", "Submitted"];

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const { q, status, role } = parseSearch(request.nextUrl.searchParams);
  const kind = role || "all"; // reuse role slot for document kind filter
  const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, 30, 100);

  const items = [];

  async function pushFrom(kindKey, rows, make, pendingList) {
    for (const r of rows) {
      const st = String(r.status || "").toLowerCase();
      const matchesStatus =
        !status || status === "all"
          ? pendingList.map((s) => s.toLowerCase()).includes(st)
          : st === status.toLowerCase();
      if (!matchesStatus) continue;
      if (q && !make(r).find((f) => f && String(f).toLowerCase().includes(q.toLowerCase()))) continue;
      const it = make(r);
      if (it) items.push({ kind: kindKey, ...it });
    }
  }

  await Promise.all([
    (async () => {
      if (kind !== "all" && kind !== "land") return;
      const rows = await LandDocument.find().sort({ createdAt: -1 }).lean();
      const users = await User.find({ _id: { $in: rows.map((r) => r.ownerId) } }).select("name username").lean();
      const uById = new Map(users.map((u) => [String(u._id), u]));
      await pushFrom("land", rows, (r) => ({
        id: String(r._id),
        ownerId: String(r.ownerId),
        ownerName: uById.get(String(r.ownerId))?.name || uById.get(String(r.ownerId))?.username || "User",
        title: LAND_TYPES[r.type] || r.type,
        label: r.label || r.filename || "",
        url: r.url || "",
        status: r.status || "pending",
        updatedAt: r.updatedAt || r.createdAt || null,
      }), PENDING_LAND);
    })(),
    (async () => {
      if (kind !== "all" && kind !== "project") return;
      const rows = await ProjectDocument.find().sort({ createdAt: -1 }).lean();
      const users = await User.find({ _id: { $in: rows.map((r) => r.builderId) } }).select("name username").lean();
      const uById = new Map(users.map((u) => [String(u._id), u]));
      await pushFrom("project", rows, (r) => ({
        id: String(r._id),
        ownerId: String(r.builderId),
        ownerName: uById.get(String(r.builderId))?.name || uById.get(String(r.builderId))?.username || "User",
        title: PROJECT_TYPES[r.category] || r.category || "Document",
        label: r.label || r.type || r.filename || "",
        url: r.url || "",
        status: r.status || "uploaded",
        updatedAt: r.updatedAt || r.createdAt || null,
      }), PENDING_PROJECT);
    })(),
    (async () => {
      if (kind !== "all" && kind !== "application") return;
      const apps = await BuyerApplication.find()
        .select("buyerId applicationNumber documents updatedAt createdAt")
        .sort({ createdAt: -1 })
        .lean();
      const users = await User.find({ _id: { $in: apps.map((a) => a.buyerId) } }).select("name username").lean();
      const uById = new Map(users.map((u) => [String(u._id), u]));
      for (const a of apps) {
        (a.documents || []).forEach((d, idx) => {
          const st = String(d.status || "Pending");
          const matchesStatus =
            !status || status === "all"
              ? PENDING_APP.includes(st)
              : st === status;
          if (!matchesStatus) return;
          if (q && !String(d.name || "").toLowerCase().includes(q.toLowerCase()) && !a.applicationNumber.toLowerCase().includes(q.toLowerCase())) return;
          items.push({
            kind: "application",
            id: String(a._id),
            docIndex: idx,
            ownerId: String(a.buyerId),
            ownerName: uById.get(String(a.buyerId))?.name || uById.get(String(a.buyerId))?.username || "Buyer",
            title: d.name || "Application Document",
            label: `${a.applicationNumber || "Application"} • doc ${idx + 1}`,
            url: d.url || "",
            status: d.status || "Pending",
            updatedAt: a.updatedAt || a.createdAt || null,
          });
        });
      }
    })(),
    (async () => {
      if (kind !== "all" && kind !== "landowner_identity") return;
      const rows = await LandownerProfile.find({ "identityDocument.status": { $in: ["pending", "submitted"] } })
        .select("userId fullName identityDocument updatedAt createdAt")
        .lean();
      const users = await User.find({ _id: { $in: rows.map((r) => r.userId) } }).select("name username").lean();
      const uById = new Map(users.map((u) => [String(u._id), u]));
      for (const r of rows) {
        const d = r.identityDocument || {};
        const st = d.status || "pending";
        if (status && status !== "all" && st !== status) continue;
        if (q && !String(uById.get(String(r.userId))?.name || "").toLowerCase().includes(q.toLowerCase())) continue;
        items.push({
          kind: "landowner_identity",
          id: String(r.userId),
          ownerId: String(r.userId),
          ownerName: uById.get(String(r.userId))?.name || uById.get(String(r.userId))?.username || "Landowner",
          title: "Identity Document",
          label: r.fullName || "",
          url: d.url || "",
          status: st,
          updatedAt: r.updatedAt || r.createdAt || null,
        });
      }
    })(),
  ]);

  items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const total = items.length;
  return ok({ items: items.slice(skip, skip + limit), total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) });
});