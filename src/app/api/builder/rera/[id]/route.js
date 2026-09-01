import { requireAuth } from "@/lib/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import ReraRegistration from "@/lib/models/ReraRegistration";
import BuilderProfile from "@/lib/models/BuilderProfile";
import { ok, fail } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { verifyReraRegistration } from "@/lib/rera";
import { audit } from "@/lib/audit";

export const GET = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Registration not found.", 400);

  await connectDB();
  const registration = await ReraRegistration.findById(id);
  if (!registration) return fail("Registration not found.", 404);
  if (String(registration.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  return ok({ registration });
});

export const POST = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Registration not found.", 400);

  await connectDB();
  const registration = await ReraRegistration.findById(id);
  if (!registration) return fail("Registration not found.", 404);
  if (String(registration.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  // Re-run the verification service. Always re-evaluates honestly.
  const result = await verifyReraRegistration({
    state: registration.state,
    registrationNumber: registration.registrationNumber,
  });

  registration.status = result.status;
  registration.source = result.source;
  registration.verifiedAt = result.verifiedAt;
  registration.lastVerifiedAt = new Date();
  registration.payload = result;
  await registration.save();

  await BuilderProfile.updateOne(
    { userId: user._id, "reraRegistrations.registrationNumber": registration.registrationNumber },
    {
      $set: {
        "reraRegistrations.$.status": result.status,
        "reraRegistrations.$.verifiedAt": result.verifiedAt,
        "reraRegistrations.$.source": result.source,
      },
    }
  );

  audit({
    actor: user._id,
    entity: "rera",
    entityId: registration._id,
    action: "rera_verified",
    metadata: { status: result.status },
  });

  return ok({ registration, message: "RERA registration updated.", status: result.status });
});

export const DELETE = withErrorHandling(async (request, ctx) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Registration not found.", 400);

  await connectDB();
  const registration = await ReraRegistration.findById(id);
  if (!registration) return fail("Registration not found.", 404);
  if (String(registration.builderId) !== String(user._id)) return fail("Unauthorized", 403);

  await BuilderProfile.updateOne(
    { userId: user._id },
    { $pull: { reraRegistrations: { registrationNumber: registration.registrationNumber } } }
  );
  await ReraRegistration.deleteOne({ _id: id });

  return ok({ message: "RERA registration removed." });
});
