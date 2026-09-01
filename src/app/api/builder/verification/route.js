import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuilderProfile from "@/lib/models/BuilderProfile";
import ReraRegistration from "@/lib/models/ReraRegistration";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

/**
 * GET /api/builder/verification
 * Returns the current verification state of each item for the builder.
 * Status is always honest - nothing is marked verified without an
 * authorized source.
 */
export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const profile = await BuilderProfile.findOne({ userId: user._id }).lean();
  const registrations = await ReraRegistration.find({ builderId: user._id }).lean();

  const v = profile?.verification || {};
  const reraVerified = registrations.some((r) => r.status === "verified");
  const reraPending = registrations.length === 0 || registrations.some((r) => r.status !== "verified");

  return ok({
    verification: {
      identity: { status: "submitted", label: "Identity" },
      business: { status: v.business || "pending", label: "Business" },
      pan: { status: v.pan || "pending", label: "PAN" },
      gst: { status: v.gst || "pending", label: "GST" },
      mca: { status: v.mca || "pending", label: "MCA / CIN" },
      address: { status: v.address || "pending", label: "Address" },
      rera: {
        status: reraVerified ? "verified" : reraPending ? "pending" : "pending",
        label: "RERA",
      },
    },
    reraRegistrations: registrations,
  });
});
