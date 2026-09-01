import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SupplierProfile from "@/lib/models/SupplierProfile";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

/**
 * GET /api/supplier/verification
 * Returns the honest verification state of each item for the supplier.
 * Nothing is marked verified without an authorized source.
 */
export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();

  const profile = await SupplierProfile.findOne({ userId: user._id }).lean();
  const v = profile?.verification || {};

  return ok({
    verification: {
      identity: { status: "submitted", label: "Identity" },
      business: { status: v.business || "pending", label: "Business" },
      gst: { status: v.gst || "pending", label: "GST" },
      pan: { status: v.pan || "pending", label: "PAN" },
      udyam: { status: v.udyam || "pending", label: "Udyam" },
      address: { status: v.address || "pending", label: "Address" },
    },
  });
});
