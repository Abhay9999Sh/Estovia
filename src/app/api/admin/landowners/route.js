import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { withErrorHandling } from "@/lib/api";
import LandownerProfile from "@/lib/models/LandownerProfile";
import LandListing from "@/lib/models/LandListing";
import { readAllStatuses, readAllMeta, deriveOverall } from "@/lib/verification";
import { queryRoleList, listResponse } from "@/lib/adminVerificationQuery";

const ROLE = "landowner";

export const GET = withErrorHandling(async (request) => {
  await requireAdmin();
  await connectDB();

  const result = await queryRoleList({
    Model: LandownerProfile,
    role: ROLE,
    searchParams: request.nextUrl.searchParams,
    profileSearch: ["fullName", "email", "pan"],
    userSearch: ["name", "email", "username", "phone"],
  });

  // Listing counts are per-user, so they are gathered for the page only rather
  // than for every landowner.
  const userIds = result.docs.map((d) => d.userId).filter(Boolean);
  const listings = await LandListing.find({ ownerId: { $in: userIds } })
    .select("ownerId verificationStatus")
    .lean();

  const listingsByOwner = new Map();
  for (const l of listings) {
    const key = String(l.ownerId);
    const bucket = listingsByOwner.get(key) || { count: 0, verified: 0, pending: 0, rejected: 0 };
    bucket.count += 1;
    if (l.verificationStatus === "verified") bucket.verified += 1;
    else if (l.verificationStatus === "rejected") bucket.rejected += 1;
    else bucket.pending += 1;
    listingsByOwner.set(key, bucket);
  }

  return listResponse(result, (p, u) => {
    const verification = readAllStatuses(ROLE, p, u);
    return {
      userId: u._id,
      name: u.name || p.fullName || u.username,
      email: u.email,
      username: u.username,
      phone: u.phone || p.phone || "",
      accountStatus: u.accountStatus || "active",
      createdAt: u.createdAt || p.createdAt || null,
      pan: p.pan || "",
      ownershipType: p.ownershipType || "individual",
      identityDocStatus: p.identityDocument?.status || "pending",
      profileCompleted: !!p.onboardingComplete,
      verification,
      verificationMeta: readAllMeta(ROLE, p, u),
      overall: deriveOverall(verification),
      listings: listingsByOwner.get(String(u._id)) || { count: 0, verified: 0, pending: 0, rejected: 0 },
    };
  });
});
