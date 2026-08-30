/**
 * Reusable API helpers: JSON responses and error handling wrapper.
 */

export function ok(data, status = 200) {
  return Response.json(data, { status });
}

export function fail(message, status = 400, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

/**
 * Wrap an async route handler with try/catch and sanitised error responses.
 * Raw server errors are never leaked to the client.
 */
export function withErrorHandling(handler) {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) {
        console.error("API error:", error);
      }
      if (status === 401) {
        return fail("Session expired. Please log in again.", 401);
      }
      if (status === 403) {
        return fail("You are not authorized to perform this action.", 403);
      }
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}

/**
 * Validate required fields. Returns first missing message or null.
 */
export function validateRequired(body, fields) {
  for (const field of fields) {
    const value = body[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      return field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    }
  }
  return null;
}

export function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

export function sanitizeText(value, max = 5000) {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").slice(0, max).trim();
}
