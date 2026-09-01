import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const UNIT_TYPES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Penthouse", "Studio", "Office", "Retail", "Villa", "Plot", "Other", ""];
const STATUSES = ["Draft", "Available", "On Hold", "Reserved", "Booked", "Sold", "Registered", "Cancelled", "Under Maintenance"];

export const PUT = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Unit not found.", 400);
  const body = await request.json();
  await connectDB();
  const unit = await ProjectUnit.findOne({ _id: id, builderId: user._id });
  if (!unit) return fail("Unit not found.", 404);

  const sizeSqFt = body.sizeSqFt !== undefined ? Math.max(0, Number(body.sizeSqFt) || 0) : unit.sizeSqFt;
  const price = body.price !== undefined ? Math.max(0, Number(body.price) || 0) : unit.price;

  if (body.unitNumber !== undefined) unit.unitNumber = sanitizeText(body.unitNumber, 60);
  if (body.tower !== undefined) unit.tower = sanitizeText(body.tower, 60);
  if (body.floor !== undefined) unit.floor = sanitizeText(body.floor, 60);
  if (body.unitType !== undefined) unit.unitType = UNIT_TYPES.includes(body.unitType) ? body.unitType : "";
  if (body.configuration !== undefined) unit.configuration = sanitizeText(body.configuration, 60);
  if (body.sizeSqFt !== undefined) unit.sizeSqFt = sizeSqFt;
  if (body.carpetAreaSqFt !== undefined) unit.carpetAreaSqFt = Math.max(0, Number(body.carpetAreaSqFt) || 0);
  if (body.builtUpAreaSqFt !== undefined) unit.builtUpAreaSqFt = Math.max(0, Number(body.builtUpAreaSqFt) || 0);
  if (body.price !== undefined) unit.price = price;
  unit.pricePerSqFt = sizeSqFt ? Math.round((price / sizeSqFt) * 100) / 100 : 0;
  if (body.facing !== undefined) unit.facing = sanitizeText(body.facing, 60);
  if (Array.isArray(body.amenities)) unit.amenities = body.amenities.map((a) => sanitizeText(a, 80)).filter(Boolean);
  if (body.description !== undefined) unit.description = sanitizeText(body.description, 2000);
  if (Array.isArray(body.images)) unit.images = body.images.map((u) => sanitizeText(u, 500)).filter(Boolean);
  if (body.floorPlanImage !== undefined) unit.floorPlanImage = sanitizeText(body.floorPlanImage, 500);
  if (body.possessionDate) unit.possessionDate = new Date(body.possessionDate);

  // Status transitions guarded: reserved/booked/sold can only move along
  // sensible business states, never straight back to Available unless the
  // buyer releases it.
  if (body.status !== undefined) {
    const next = body.status;
    if (["Booked", "Sold", "Registered"].includes(next)) {
      if (unit.status !== "Reserved") return fail("Unit must be reserved before booking or selling.", 400);
      unit.status = next;
      if (next === "Sold" || next === "Registered") unit.soldAt = new Date();
    } else if (STATUSES.includes(next)) {
      if (["Booked", "Sold", "Registered"].includes(unit.status)) {
        return fail("This unit is booked/sold and cannot be changed this way.", 400);
      }
      unit.status = next;
    } else {
      return fail("Invalid status.", 400);
    }
  }

  if (body.isActive !== undefined) unit.isActive = !!body.isActive;
  await unit.save();
  return ok({ unit: unit.toObject(), message: "Unit updated." });
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Unit not found.", 400);
  await connectDB();
  const unit = await ProjectUnit.findOne({ _id: id, builderId: user._id });
  if (!unit) return fail("Unit not found.", 404);
  if (["Booked", "Sold", "Registered"].includes(unit.status)) {
    return fail("This unit is booked/sold and cannot be deleted.", 400);
  }
  await unit.deleteOne();
  return ok({ message: "Unit deleted." });
});
