import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { ok, fail, sanitizeText } from "@/lib/api";

export async function GET() {
  return fail("Not supported.", 405);
}

export async function PUT(request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    await connectDB();

    const update = {};
    if (body.name !== undefined) update.name = sanitizeText(body.name, 80);
    if (body.phone !== undefined) update.phone = sanitizeText(body.phone, 20);
    if (body.address !== undefined) update.address = sanitizeText(body.address, 400);
    if (body.avatar !== undefined) update.avatar = sanitizeText(body.avatar, 500);
    if (body.dob !== undefined) update.dob = body.dob ? new Date(body.dob) : null;

    if (Object.keys(update).length === 0) {
      return fail("No fields to update.", 400);
    }

    const updated = await User.findByIdAndUpdate(user._id, update, { new: true })
      .lean();

    const { passwordHash: _ph, ...safeUser } = updated;
    return ok({ user: safeUser, message: "Profile updated successfully." });
  } catch (error) {
    console.error("Update profile error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
