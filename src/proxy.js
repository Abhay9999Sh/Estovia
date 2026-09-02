import { NextResponse } from "next/server";

const COOKIE_NAME = "estovia_session";

const PROTECTED_PREFIXES = [
  "/builder",
  "/supplier",
  "/buyer",
  "/landowner",
  "/account",
  "/complete-profile",
  "/admin",
];

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/explore",
  "/land",
  "/builders",
  "/suppliers",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/land",
  "/api/notifications",
  "/api/builders",
  "/api/suppliers",
];

// Public single-profile detail routes (public browsing) — e.g. /builder/<id>
// or /supplier/<id>, where <id> is a MongoDB ObjectId. Any named sub-route
// (dashboard, onboarding, profile, ...) under the same prefixes stays protected.
const OBJECT_ID = /^[0-9a-f]{24}$/i;

function isPublicProfileDetail(pathname) {
  if (pathname.startsWith("/api/builder/") || pathname.startsWith("/api/supplier/")) {
    const rest = pathname.split("/").filter(Boolean);
    // /api/builder/<id>  or  /api/supplier/<id>
    return rest.length === 3 && OBJECT_ID.test(rest[2]);
  }
  if (pathname.startsWith("/builder/") || pathname.startsWith("/supplier/")) {
    const rest = pathname.split("/").filter(Boolean);
    // /builder/<id>  or  /supplier/<id>
    return rest.length === 2 && OBJECT_ID.test(rest[1]);
  }
  return false;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    isPublicProfileDetail(pathname)
  ) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
