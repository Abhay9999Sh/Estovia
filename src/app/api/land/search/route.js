import { connectDB } from "@/lib/mongodb";
import LandListing from "@/lib/models/LandListing";
import User from "@/lib/models/User";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") || "").trim();
  const propertyType = searchParams.get("propertyType") || "";
  const location = (searchParams.get("location") || "").trim();
  const verifiedOnly = searchParams.get("verifiedOnly") === "true";
  const minArea = Number(searchParams.get("minArea")) || 0;
  const maxArea = Number(searchParams.get("maxArea")) || 0;
  const minPrice = Number(searchParams.get("minPrice")) || 0;
  const maxPrice = Number(searchParams.get("maxPrice")) || 0;
  const limit = Math.min(Number(searchParams.get("limit")) || 12, 50);

  await connectDB();

  const filter = { status: "active" };
  if (verifiedOnly) filter.verificationStatus = "verified";
  if (propertyType) filter.propertyType = propertyType;

  const conditions = [];
  if (q) {
    conditions.push({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    });
  }
  if (location) {
    conditions.push({
      $or: [
        { "location.address": { $regex: location, $options: "i" } },
        { "location.city": { $regex: location, $options: "i" } },
        { "location.district": { $regex: location, $options: "i" } },
        { "location.state": { $regex: location, $options: "i" } },
      ],
    });
  }
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

  const dbListings = await LandListing.find(filter)
    .select("title description propertyType landUse area location pricing verificationStatus status images views interestedUsers ownerId createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (dbListings.length === 0) {
    return ok({ listings: [], source: "db" });
  }

  const ownerIds = [...new Set(dbListings.map((l) => l.ownerId).filter(Boolean))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("name avatar").lean();
  const ownerMap = {};
  for (const o of owners) ownerMap[o._id] = o;

  const listings = dbListings.map((l) => ({
    ...l,
    owner: l.ownerId && ownerMap[l.ownerId]
      ? { name: ownerMap[l.ownerId].name, avatar: ownerMap[l.ownerId].avatar }
      : null,
  }));

  return ok({ listings, source: "db" });
});
