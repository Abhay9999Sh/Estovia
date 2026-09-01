import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import { ok, fail, sanitizeText, validateRequired } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const UNIT_TYPES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Penthouse", "Studio", "Office", "Retail", "Villa", "Plot", "Other", ""];
const STATUSES = ["Draft", "Available", "On Hold", "Reserved", "Booked", "Sold", "Registered", "Cancelled", "Under Maintenance"];

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);
  await connectDB();
  const project = await Project.findOne({ _id: id, builderId: user._id });
  if (!project) return fail("Project not found.", 404);
  const units = await ProjectUnit.find({ projectId: id }).sort({ tower: 1, floor: 1, unitNumber: 1 }).lean();
  return ok({ units });
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Project not found.", 400);
  const body = await request.json();
  await connectDB();
  const project = await Project.findOne({ _id: id, builderId: user._id });
  if (!project) return fail("Project not found.", 404);

  const missing = validateRequired(body, ["unitNumber"]);
  if (missing) return fail(`${missing} is required.`);

  const sizeSqFt = Math.max(0, Number(body.sizeSqFt) || 0);
  const price = Math.max(0, Number(body.price) || 0);

  const unit = await ProjectUnit.create({
    projectId: project._id,
    builderId: user._id,
    unitNumber: sanitizeText(body.unitNumber, 60),
    tower: sanitizeText(body.tower, 60),
    floor: sanitizeText(body.floor, 60),
    unitType: UNIT_TYPES.includes(body.unitType) ? body.unitType : "",
    configuration: sanitizeText(body.configuration, 60),
    sizeSqFt,
    carpetAreaSqFt: Math.max(0, Number(body.carpetAreaSqFt) || sizeSqFt),
    builtUpAreaSqFt: Math.max(0, Number(body.builtUpAreaSqFt) || 0),
    price,
    pricePerSqFt: sizeSqFt ? Math.round((price / sizeSqFt) * 100) / 100 : 0,
    facing: sanitizeText(body.facing, 60),
    amenities: Array.isArray(body.amenities) ? body.amenities.map((a) => sanitizeText(a, 80)).filter(Boolean) : [],
    description: sanitizeText(body.description, 2000),
    images: Array.isArray(body.images) ? body.images.map((u) => sanitizeText(u, 500)).filter(Boolean) : [],
    floorPlanImage: sanitizeText(body.floorPlanImage, 500),
    possessionDate: body.possessionDate ? new Date(body.possessionDate) : null,
    status: STATUSES.includes(body.status) ? body.status : "Draft",
    isActive: body.isActive !== false,
  });

  return ok({ unit, message: "Unit created." }, 201);
});
