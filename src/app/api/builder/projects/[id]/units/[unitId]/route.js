import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const UNIT_TYPES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Penthouse", "Studio", "Office", "Retail", "Villa", "Plot", "Other", ""];
const STATUSES = ["Draft", "Available", "On Hold", "Reserved", "Booked", "Sold", "Registered", "Cancelled", "Under Maintenance"];

export const PATCH = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id, unitId } = await ctx.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(unitId)) return fail("Invalid ID.", 400);
  const body = await request.json();
  await connectDB();
  const project = await Project.findOne({ _id: id, builderId: user._id });
  if (!project) return fail("Project not found.", 404);

  const unit = await ProjectUnit.findOne({ _id: unitId, projectId: id });
  if (!unit) return fail("Unit not found.", 404);

  if (unit.status === "Sold" || unit.status === "Registered") {
    return fail("Cannot edit a sold or registered unit.", 400);
  }

  if (body.unitNumber !== undefined) unit.unitNumber = sanitizeText(body.unitNumber, 60);
  if (body.tower !== undefined) unit.tower = sanitizeText(body.tower, 60);
  if (body.floor !== undefined) unit.floor = sanitizeText(body.floor, 60);
  if (body.unitType !== undefined) unit.unitType = UNIT_TYPES.includes(body.unitType) ? body.unitType : unit.unitType;
  if (body.configuration !== undefined) unit.configuration = sanitizeText(body.configuration, 60);
  if (body.sizeSqFt !== undefined) {
    unit.sizeSqFt = Math.max(0, Number(body.sizeSqFt) || 0);
    if (unit.price && unit.sizeSqFt) {
      unit.pricePerSqFt = Math.round((unit.price / unit.sizeSqFt) * 100) / 100;
    }
  }
  if (body.carpetAreaSqFt !== undefined) unit.carpetAreaSqFt = Math.max(0, Number(body.carpetAreaSqFt) || 0);
  if (body.builtUpAreaSqFt !== undefined) unit.builtUpAreaSqFt = Math.max(0, Number(body.builtUpAreaSqFt) || 0);
  if (body.price !== undefined) {
    unit.price = Math.max(0, Number(body.price) || 0);
    if (unit.sizeSqFt) {
      unit.pricePerSqFt = Math.round((unit.price / unit.sizeSqFt) * 100) / 100;
    }
  }
  if (body.facing !== undefined) unit.facing = sanitizeText(body.facing, 60);
  if (body.amenities !== undefined) unit.amenities = Array.isArray(body.amenities) ? body.amenities.map((a) => sanitizeText(a, 80)).filter(Boolean) : [];
  if (body.description !== undefined) unit.description = sanitizeText(body.description, 2000);
  if (body.images !== undefined) unit.images = Array.isArray(body.images) ? body.images.map((u) => sanitizeText(u, 500)).filter(Boolean) : [];
  if (body.floorPlanImage !== undefined) unit.floorPlanImage = sanitizeText(body.floorPlanImage, 500);
  if (body.possessionDate !== undefined) unit.possessionDate = body.possessionDate ? new Date(body.possessionDate) : null;
  if (body.status !== undefined && STATUSES.includes(body.status)) unit.status = body.status;
  if (body.isActive !== undefined) unit.isActive = !!body.isActive;

  await unit.save();
  return ok({ unit, message: "Unit updated." });
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id, unitId } = await ctx.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(unitId)) return fail("Invalid ID.", 400);
  await connectDB();
  const project = await Project.findOne({ _id: id, builderId: user._id });
  if (!project) return fail("Project not found.", 404);

  const unit = await ProjectUnit.findOne({ _id: unitId, projectId: id });
  if (!unit) return fail("Unit not found.", 404);

  if (unit.status === "Sold" || unit.status === "Registered" || unit.status === "Booked") {
    return fail("Cannot delete a sold, registered, or booked unit.", 400);
  }

  await ProjectUnit.findByIdAndDelete(unitId);
  return ok({ message: "Unit deleted." });
});
