import { cookies } from "next/headers";
import crypto from "crypto";

export const COOKIE_NAME = "estovia_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

function getSecret() {
  return process.env.AUTH_SECRET || "dev_insecure_secret_change_me";
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

function sign(data) {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/**
 * Create a signed, httpOnly session token containing the user id and
 * expiry. The payload is NOT encrypted - it contains only a user id and
 * timestamp, so no sensitive data is exposed. It is signed so it cannot
 * be tampered with.
 */
export async function createSessionToken(userId) {
  const payload = {
    sub: String(userId),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL,
  };

  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a session token and return the payload, or null if invalid/expired.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  const expected = sign(encodedPayload);
  const actual = signature;
  if (actual !== expected) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
    if (!payload.sub) return null;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Read the current session token from cookies (server-side helper).
 */
export async function getSessionToken() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value || null;
}

/**
 * Set the session cookie on a response.
 * @param {import('next/server').NextResponse} response
 * @param {string} token
 */
export function setSessionCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return response;
}

/**
 * Clear the session cookie.
 * @param {import('next/server').NextResponse} response
 */
export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
