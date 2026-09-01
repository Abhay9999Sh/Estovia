import { requireAuth, hasRole } from "@/lib/auth";
import { fail } from "@/lib/api";

/**
 * Require the caller to be authenticated AND hold the admin role.
 * Throws (or returns) an error that `withErrorHandling` renders as 403.
 */
export async function requireAdmin() {
  const user = await requireAuth();
  if (!hasRole(user, "admin")) {
    const error = new Error("Admin access required.");
    error.status = 403;
    throw error;
  }
  return user;
}

/**
 * Helper to build a standard fail() response as a drop-in inside handlers
 * that want to return rather than throw.
 */
export function adminError(message, status = 403) {
  return fail(message, status);
}

/**
 * Parse common pagination query params. Returns sane numeric bounds.
 */
export function parsePagination(searchParams, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function parseSearch(searchParams) {
  const q = (searchParams.get("search") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const role = (searchParams.get("role") || "").trim();
  return { q, status, role };
}