import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { hashPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { ok, fail } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();

    const name = (body.name || "").trim();
    const username = (body.username || "").trim().toLowerCase();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const confirmPassword = body.confirmPassword || "";

    if (!name) return fail("Please provide your full name.");
    if (name.length > 80) return fail("Name cannot be longer than 80 characters.");

    if (!username) return fail("Please provide a username.");
    if (username.length < 3) return fail("Username must be at least 3 characters.");
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
      return fail("Username can only contain letters, numbers, dots and underscores.");
    }

    if (!email) return fail("Please provide an email.");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return fail("Please provide a valid email address.");
    }

    if (!password) return fail("Please provide a password.");
    if (password.length < 8) {
      return fail("Password must be at least 8 characters.");
    }
    if (password.length > 72) {
      return fail("Password cannot be longer than 72 characters.");
    }
    if (confirmPassword !== password) {
      return fail("Passwords do not match.");
    }

    await connectDB();

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return fail("This email is already registered.", 409);
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return fail("Username already exists.", 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name,
      username,
      email,
      passwordHash,
      roles: ["viewer"],
      profileCompleted: false,
      verification: { identity: "pending", address: "pending", phone: "pending" },
    });

    const token = await createSessionToken(user._id);

    const { passwordHash: _ph, ...safeUser } = user.toObject();

    const response = NextResponse.json(
      { user: safeUser, message: "Account created successfully." },
      { status: 201 }
    );
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Register error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
