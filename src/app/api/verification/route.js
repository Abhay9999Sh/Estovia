import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Verification from "@/lib/models/Verification";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { searchParams } = request.nextUrl;
  const landId = searchParams.get("landId") || "";

  await connectDB();

  const filter = { $or: [{ userId: user._id }, { ownerId: user._id }] };
  if (landId) filter.landId = landId;

  const verifications = await Verification.find(filter).sort({ createdAt: -1 }).lean();
  return ok({ verifications });
});
