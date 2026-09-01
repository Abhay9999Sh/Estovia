import { connectDB } from "@/lib/mongodb";
import {
  getSessionToken,
  verifySessionToken,
} from "@/lib/session";
import User from "@/lib/models/User";

/**
 * Resolve the currently authenticated user from the session cookie.
 * Returns the user document (without password hash) or null.
 */
export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  try {
    await connectDB();
    const user = await User.findById(payload.sub).lean();
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  } catch (err) {
    return null;
  }
}

/**
 * Require authentication. Returns { user } on success or throws with a
 * status for the caller to handle. For Route Handlers use requireAuthApi.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error("You are not authorized to perform this action.");
    error.status = 401;
    throw error;
  }
  if (user.accountStatus && user.accountStatus !== "active") {
    const error = new Error(
      user.accountStatus === "suspended"
        ? "Your account has been suspended. Please contact support."
        : "Your account has been deactivated. Please contact support."
    );
    error.status = 403;
    throw error;
  }
  return user;
}

/**
 * Require a specific role. Call after requireAuth.
 */
export function hasRole(user, roles) {
  if (!user || !Array.isArray(user.roles)) return false;
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.some((r) => user.roles.includes(r));
}

export async function requireRole(roles) {
  const user = await requireAuth();
  if (!hasRole(user, roles)) {
    const error = new Error("You are not authorized to perform this action.");
    error.status = 403;
    throw error;
  }
  return user;
}

/**
 * Wrap an async route handler with standard auth error handling.
 * @param {(user, request, ctx) => Promise<Response>} handler
 */
export function withAuth(handler, roles) {
  return async (request, ctx) => {
    try {
      const user = roles ? await requireRole(roles) : await requireAuth();
      return await handler(user, request, ctx);
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) {
        console.error("Auth route error:", error);
      }
      return Response.json(
        {
          error:
            status === 401
              ? "Session expired. Please log in again."
              : status === 403
              ? "You are not authorized to perform this action."
              : "Something went wrong. Please try again.",
        },
        { status }
      );
    }
  };
}
