import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierRequirement from "@/lib/models/SupplierRequirement";
import Project from "@/lib/models/Project";
import { ok, fail, sanitizeText, validateRequired } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  await connectDB();
  const filter = { builderId: user._id };
  if (projectId) filter.projectId = projectId;
  const requirements = await SupplierRequirement.find(filter)
    .sort({ createdAt: -1 })
    .populate("projectId", "name")
    .lean();
  return ok({ requirements });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();

  const missing = validateRequired(body, ["projectId", "title"]);
  if (missing) return fail(`${missing} is required.`);

  const project = await Project.findOne({ _id: body.projectId, builderId: user._id });
  if (!project) return fail("Project not found or not owned by you.", 403);

  const lineItems = Array.isArray(body.lineItems)
    ? body.lineItems.slice(0, 200).map((l) => ({
        item: sanitizeText(l.item, 200),
        quantity: Math.max(0, Number(l.quantity) || 0),
        unit: sanitizeText(l.unit, 40),
        specification: sanitizeText(l.specification, 1000),
      }))
    : [];

  const requirement = await SupplierRequirement.create({
    builderId: user._id,
    projectId: body.projectId,
    materialRequirementId: body.materialRequirementId || null,
    title: sanitizeText(body.title, 200),
    category: sanitizeText(body.category, 120),
    description: sanitizeText(body.description, 2000),
    lineItems,
    estimatedValue: Math.max(0, Number(body.estimatedValue) || 0),
    deliveryLocation: sanitizeText(body.deliveryLocation, 500),
    requiredBy: body.requiredBy ? new Date(body.requiredBy) : null,
    validUntil: body.validUntil ? new Date(body.validUntil) : null,
    visibility: body.visibility === "private" ? "private" : "public",
    invitedSupplierIds: Array.isArray(body.invitedSupplierIds)
      ? body.invitedSupplierIds.filter((s) => sanitizeText(s, 100))
      : [],
    status: "Open",
  });

  return ok({ requirement, message: "Requirement published." }, 201);
});
