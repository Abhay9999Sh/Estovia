import { requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import LandListing from "@/lib/models/LandListing";
import LandDocument from "@/lib/models/LandDocument";
import { ok, fail, sanitizeText, isValidEmail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const PROPERTY_TYPES = ["land", "residential", "commercial", "apartment", "plot", "project"];
const LAND_USES = ["agricultural", "residential", "commercial", "industrial", "mixed", "farmhouse", "institutional"];
const AREA_UNITS = ["sqft", "sqm", "acre", "hectare", "gunta", "bigha", "marla"];
const PRICE_TYPES = ["total", "per_sqft", "per_acre", "negotiable"];

function normalizeListingBody(body) {
  return {
    title: sanitizeText(body.title, 120),
    description: sanitizeText(body.description, 5000),
    propertyType: PROPERTY_TYPES.includes(body.propertyType) ? body.propertyType : "land",
    landUse: LAND_USES.includes(body.landUse) ? body.landUse : "agricultural",
    area: {
      value: Number(body.area?.value),
      unit: AREA_UNITS.includes(body.area?.unit) ? body.area.unit : "sqft",
    },
    location: {
      address: sanitizeText(body.location?.address, 500),
      city: sanitizeText(body.location?.city, 80),
      district: sanitizeText(body.location?.district, 80),
      state: sanitizeText(body.location?.state, 80),
      pincode: sanitizeText(body.location?.pincode, 12),
      tehsil: sanitizeText(body.location?.tehsil, 80),
      village: sanitizeText(body.location?.village, 80),
      latitude: Number(body.location?.latitude) || null,
      longitude: Number(body.location?.longitude) || null,
    },
    boundary: body.boundary && Array.isArray(body.boundary?.coordinates)
      ? { type: "Polygon", coordinates: body.boundary.coordinates }
      : { type: "Polygon", coordinates: [] },
    pricing: {
      amount: Number(body.pricing?.amount) || 0,
      type: PRICE_TYPES.includes(body.pricing?.type) ? body.pricing.type : "total",
      negotiable: !!body.pricing?.negotiable,
    },
    surveyNumber: sanitizeText(body.surveyNumber, 40),
    khasraNumber: sanitizeText(body.khasraNumber, 40),
    images: Array.isArray(body.images) ? body.images.slice(0, 10).map((i) => sanitizeText(i, 500)) : [],
  };
}

function validateListing(data) {
  if (!data.title) return "Please provide a title for the land.";
  if (!data.location?.address) return "Please select the land location on the map.";
  if (data.location.latitude == null || data.location.longitude == null) {
    return "Invalid location. Please select the location on the map.";
  }
  if (!data.location.city) return "Please provide the city.";
  if (!data.location.state) return "Please provide the state.";
  if (!(data.area?.value > 0)) return "Please provide a valid area.";
  if (!(data.pricing?.amount > 0)) return "Please provide a valid expected price.";
  return null;
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireRole(["landowner", "admin", "viewer"]);
  // A viewer can query their own listings too (they might have drafts)
  await connectDB();
  const listings = await LandListing.find({ ownerId: user._id })
    .sort({ createdAt: -1 })
    .lean();
  return ok({ listings });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(["landowner", "admin"]);

  const body = await request.json();
  const data = normalizeListingBody(body);

  const submit = body.submit === true;

  // Full validation is only required when the listing is submitted for
  // review. Drafts may be saved even if incomplete.
  const validationError = submit ? validateListing(data) : null;
  if (validationError) {
    return fail(validationError, 400);
  }

  await connectDB();

  const listing = await LandListing.create({
    ...data,
    ownerId: user._id,
    status: submit ? "active" : "draft",
    verificationStatus: submit ? "submitted" : "draft",
  });

  return ok(
    { listing, message: submit ? "Land submitted for verification." : "Draft saved." },
    201
  );
});
