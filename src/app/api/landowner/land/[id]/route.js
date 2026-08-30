import { requireRole } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import LandListing from "@/lib/models/LandListing";
import LandDocument from "@/lib/models/LandDocument";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const PROPERTY_TYPES = ["land", "residential", "commercial", "apartment", "plot", "project"];
const LAND_USES = ["agricultural", "residential", "commercial", "industrial", "mixed", "farmhouse", "institutional"];
const AREA_UNITS = ["sqft", "sqm", "acre", "hectare", "gunta", "bigha", "marla"];
const PRICE_TYPES = ["total", "per_sqft", "per_acre", "negotiable"];

async function getOwnedListing(user, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const listing = await LandListing.findById(id);
  if (!listing) return null;
  if (String(listing.ownerId) !== String(user._id)) return null;
  return listing;
}

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireRole(["landowner", "admin", "viewer"]);
  const { id } = await ctx.params;
  await connectDB();

  const listing = await getOwnedListing(user, id);
  if (!listing) return fail("Listing not found.", 404);

  const documents = await LandDocument.find({ landId: id }).lean();

  return ok({ listing, documents });
});

export const PATCH = withErrorHandling(async (request, ctx) => {
  const user = await requireRole(["landowner", "admin"]);
  const { id } = await ctx.params;
  await connectDB();

  const listing = await getOwnedListing(user, id);
  if (!listing) return fail("Listing not found.", 404);

  const body = await request.json();

  // Capture prior sensitive values to detect critical changes
  const prior = {
    ownerChanged: false,
    areaChanged: false,
    locationChanged: false,
    priceChanged: false,
  };

  if (body.area && (body.area.value != null || body.area.unit)) {
    if (
      Number(body.area.value) !== (listing.area?.value || 0) ||
      body.area.unit !== listing.area?.unit
    ) {
      prior.areaChanged = true;
    }
    if (body.area.value != null) listing.area.value = Number(body.area.value);
    if (body.area.unit) listing.area.unit = body.area.unit;
  }

  if (body.location && typeof body.location === "object") {
    const loc = { ...(listing.location?.toObject?.() || listing.location || {}) };
    if (body.location.latitude != null) {
      const lat = Number(body.location.latitude);
      if (lat !== listing.location?.latitude) prior.locationChanged = true;
      loc.latitude = lat;
    }
    if (body.location.longitude != null) {
      const lng = Number(body.location.longitude);
      if (lng !== listing.location?.longitude) prior.locationChanged = true;
      loc.longitude = lng;
    }
    for (const key of ["address", "city", "district", "state", "pincode", "tehsil", "village"]) {
      if (body.location[key] !== undefined) loc[key] = sanitizeText(body.location[key], key === "address" ? 500 : 80);
    }
    listing.location = loc;
  }

  if (body.boundary && Array.isArray(body.boundary?.coordinates)) {
    listing.boundary = { type: "Polygon", coordinates: body.boundary.coordinates };
  }

  if (body.pricing && typeof body.pricing === "object") {
    if (body.pricing.amount !== undefined) {
      const amt = Number(body.pricing.amount);
      if (amt !== (listing.pricing?.amount || 0)) prior.priceChanged = true;
      listing.pricing.amount = amt;
    }
    if (body.pricing.type) listing.pricing.type = body.pricing.type;
    if (body.pricing.negotiable !== undefined) listing.pricing.negotiable = !!body.pricing.negotiable;
  }

  for (const key of ["title", "description", "landUse", "propertyType", "surveyNumber", "khasraNumber"]) {
    if (body[key] !== undefined) {
      if (key === "title") listing.title = sanitizeText(body.title, 120);
      else if (key === "description") listing.description = sanitizeText(body.description, 5000);
      else if (key === "propertyType") listing.propertyType = PROPERTY_TYPES.includes(body.propertyType) ? body.propertyType : listing.propertyType;
      else if (key === "landUse") listing.landUse = LAND_USES.includes(body.landUse) ? body.landUse : listing.landUse;
      else listing[key] = sanitizeText(body[key], 40);
    }
  }

  if (Array.isArray(body.images)) {
    listing.images = body.images.slice(0, 10).map((i) => sanitizeText(i, 500));
  }

  // If critical/sensitive ownership information changed, reset verification.
  if (prior.areaChanged || prior.locationChanged || prior.priceChanged) {
    if (
      listing.verificationStatus === "verified" ||
      listing.verificationStatus === "partially_verified"
    ) {
      listing.verificationStatus = "under_review";
    }
    if (listing.status === "active") {
      listing.status = "paused";
    }
  }

  // Status transitions (pause/resume). A landowner can freely toggle
  // between active and paused. Reactivating a listing does not depend on
  // its verification status - review and verification are tracked
  // separately from visibility.
  if (body.status) {
    const validStatuses = ["draft", "active", "paused", "sold", "rejected"];
    if (validStatuses.includes(body.status)) {
      listing.status = body.status;
    }
  }

  await listing.save();

  return ok({ listing, message: "Listing updated successfully." });
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireRole(["landowner", "admin"]);
  const { id } = await ctx.params;
  await connectDB();

  const listing = await getOwnedListing(user, id);
  if (!listing) return fail("Listing not found.", 404);

  await LandDocument.deleteMany({ landId: id });
  await LandListing.deleteOne({ _id: id });

  return ok({ message: "Listing deleted successfully." });
});
