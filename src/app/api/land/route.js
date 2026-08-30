import { connectDB } from "@/lib/mongodb";
import LandListing from "@/lib/models/LandListing";
import User from "@/lib/models/User";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { DEMO_LAND_LISTINGS } from "@/lib/demoData";

/**
 * Public land listing discovery. Only returns safe, publicly visible info.
 * Private fields (documents, identity) are never exposed here.
 */
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = request.nextUrl;
  const location = searchParams.get("location") || "";
  const propertyType = searchParams.get("propertyType") || "";
  const minArea = Number(searchParams.get("minArea")) || 0;
  const maxArea = Number(searchParams.get("maxArea")) || 0;
  const minPrice = Number(searchParams.get("minPrice")) || 0;
  const maxPrice = Number(searchParams.get("maxPrice")) || 0;
  const verifiedOnly = searchParams.get("verifiedOnly") === "true";
  const limit = Math.min(Number(searchParams.get("limit")) || 12, 50);

  let listings;

  await connectDB();

  const filter = { status: "active" };
  if (verifiedOnly) {
    filter.verificationStatus = "verified";
  }
  if (propertyType) filter.propertyType = propertyType;
  if (minArea || maxArea) {
    filter["area.value"] = {};
    if (minArea) filter["area.value"].$gte = minArea;
    if (maxArea) filter["area.value"].$lte = maxArea;
  }
  if (minPrice || maxPrice) {
    filter["pricing.amount"] = {};
    if (minPrice) filter["pricing.amount"].$gte = minPrice;
    if (maxPrice) filter["pricing.amount"].$lte = maxPrice;
  }

  const textSearch = location.trim();
  if (textSearch) {
    filter.$or = [
      { "location.address": { $regex: textSearch, $options: "i" } },
      { "location.city": { $regex: textSearch, $options: "i" } },
      { "location.district": { $regex: textSearch, $options: "i" } },
      { "location.state": { $regex: textSearch, $options: "i" } },
    ];
  }

  const dbListings = await LandListing.find(filter)
    .select("title description propertyType landUse area location pricing verificationStatus status images views interestedUsers ownerId createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Attach owner names (public display only)
  const ownerIds = [...new Set(dbListings.map((l) => l.ownerId).filter(Boolean))];
  const owners = await User.find({ _id: { $in: ownerIds } })
    .select("name avatar")
    .lean();
  const ownerMap = {};
  for (const o of owners) ownerMap[o._id] = o;

  listings = dbListings.map((l) => ({
    ...l,
    owner: l.ownerId && ownerMap[l.ownerId]
      ? { name: ownerMap[l.ownerId].name, avatar: ownerMap[l.ownerId].avatar }
      : null,
  }));

  // Fallback to demo data when database has no active listings
  if (listings.length === 0) {
    return ok({ listings: DEMO_LAND_LISTINGS, source: "demo" });
  }

  return ok({ listings, source: "db" });
});
