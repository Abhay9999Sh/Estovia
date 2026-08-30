import { clearSessionCookie } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully." });
  clearSessionCookie(response);
  return response;
}
