import { NextResponse } from "next/server";

const COOKIE_NAME = "estovia_session";

const PROTECTED_PREFIXES = [
  "/builder",
  "/supplier",
  "/buyer",
  "/landowner",
  "/account",
  "/complete-profile",
];

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/explore",
  "/land",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/land",
  "/api/notifications",
];

export function proxy(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
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
