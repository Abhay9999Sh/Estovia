import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import LandListing from "@/lib/models/LandListing";
import User from "@/lib/models/User";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { "pricing.amount": 1 },
  price_desc: { "pricing.amount": -1 },
  area_asc: { "area.value": 1 },
  area_desc: { "area.value": -1 },
  views: { views: -1 },
};

/**
 * Builder land discovery. Queries the EXISTING LandListing collection
 * created by landowners - no separate builder-land dataset.
 */
export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { searchParams } = request.nextUrl;

  const q = (searchParams.get("q") || "").trim();
  const propertyType = searchParams.get("propertyType") || "";
  const landUse = searchParams.get("landUse") || "";
  const state = (searchParams.get("state") || "").trim();
  const city = (searchParams.get("city") || "").trim();
  const district = (searchParams.get("district") || "").trim();
  const verifiedOnly = searchParams.get("verifiedOnly") === "true";
  const minArea = Number(searchParams.get("minArea")) || 0;
  const maxArea = Number(searchParams.get("maxArea")) || 0;
  const minPrice = Number(searchParams.get("minPrice")) || 0;
  const maxPrice = Number(searchParams.get("maxPrice")) || 0;
  const sort = SORTS[searchParams.get("sort")] || SORTS.newest;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
  const skip = (page - 1) * limit;

  await connectDB();

  const filter = { status: "active" };
  const conditions = [];

  if (q) {
    conditions.push({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    });
  }
  if (verifiedOnly) filter.verificationStatus = "verified";
  if (propertyType) filter.propertyType = propertyType;
  if (landUse) filter.landUse = landUse;
  if (state) filter["location.state"] = state;
  if (city) filter["location.city"] = city;
  if (district) filter["location.district"] = district;

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
  if (conditions.length) filter.$and = conditions;

  const [items, total] = await Promise.all([
    LandListing.find(filter)
      .select(
        "title description propertyType landUse area location boundary pricing verificationStatus status images views interestedUsers ownerId createdAt"
      )
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    LandListing.countDocuments(filter),
  ]);

  const ownerIds = [...new Set(items.map((l) => l.ownerId).filter(Boolean))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("name avatar username").lean();
  const ownerMap = {};
  for (const o of owners) ownerMap[String(o._id)] = o;

  const listings = items
    .map((l) => ({
      ...l,
      owner: l.ownerId && ownerMap[String(l.ownerId)]
        ? { name: ownerMap[String(l.ownerId)].name, avatar: ownerMap[String(l.ownerId)].avatar, username: ownerMap[String(l.ownerId)].username }
        : null,
    }))
    // Hide boundary coords from list payload unless actually needed for map
    .map(({ boundary, ...rest }) => rest);

  return ok({
    listings,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    limit,
  });
});
