import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { fail } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();

    const identifier = (body.identifier || "").trim().toLowerCase();
    const password = body.password || "";

    if (!identifier) return fail("Please provide your email or username.");
    if (!password) return fail("Please provide your password.");

    await connectDB();

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select("+passwordHash");

    if (!user) {
      return fail("Invalid email/username or password.", 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return fail("Invalid email/username or password.", 401);
    }

    const token = await createSessionToken(user._id);

    const { passwordHash: _ph, ...safeUser } = user.toObject();

    const response = NextResponse.json({
      user: safeUser,
      message: "Logged in successfully.",
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
