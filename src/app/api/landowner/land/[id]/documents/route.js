import { requireRole } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import LandListing from "@/lib/models/LandListing";
import LandDocument from "@/lib/models/LandDocument";
import Verification from "@/lib/models/Verification";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const DOC_TYPES = [
  "sale_deed",
  "mutation",
  "land_record",
  "encumbrance",
  "tax_receipt",
  "survey_map",
  "other",
];

async function getOwnedListing(user, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const listing = await LandListing.findById(id);
  if (!listing) return null;
  if (String(listing.ownerId) !== String(user._id)) return null;
  return listing;
}

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireRole(["landowner", "admin"]);
  const { id } = await ctx.params;
  await connectDB();

  const listing = await getOwnedListing(user, id);
  if (!listing) return fail("Listing not found.", 404);

  const documents = await LandDocument.find({ landId: id }).sort({ createdAt: -1 }).lean();
  return ok({ documents });
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireRole(["landowner", "admin"]);
  const { id } = await ctx.params;
  await connectDB();

  const listing = await getOwnedListing(user, id);
  if (!listing) return fail("Listing not found.", 404);

  const body = await request.json();

  const type = DOC_TYPES.includes(body.type) ? body.type : "other";
  const docs = Array.isArray(body.documents) ? body.documents : [];

  const created = [];
  for (const doc of docs) {
    const mediaType = ["video", "image", "document"].includes(doc.mediaType)
      ? doc.mediaType
      : "document";
    const newDoc = await LandDocument.create({
      landId: listing._id,
      ownerId: user._id,
      type,
      label: sanitizeText(doc.label || body.label || "", 120),
      filename: sanitizeText(doc.filename || "", 200),
      url: sanitizeText(doc.url || "", 500),
      mediaType,
      status: doc.status === "rejected" ? "pending" : "submitted",
    });
    created.push(newDoc);
  }

  if (created.length > 0) {
    // Update listing verification status to reflect documents submitted
    if (
      listing.verificationStatus === "draft" ||
      listing.verificationStatus === "rejected"
    ) {
      listing.verificationStatus = "submitted";
      await listing.save();
    }

    // Track in verification collection
    await Verification.findOneAndUpdate(
      { type: "LAND_OWNERSHIP", landId: listing._id, ownerId: user._id },
      {
        $set: {
          type: "LAND_OWNERSHIP",
          landId: listing._id,
          ownerId: user._id,
          userId: user._id,
          status: "submitted",
        },
        $addToSet: { documents: { $each: created.map((c) => c._id) } },
      },
      { upsert: true }
    );
  }

  return ok({ documents: created, message: "Documents uploaded successfully." }, 201);
});
