import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "pos_session";

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || "pos-demo-secret"
  );
}

async function readSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSession(request);

  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/products/") ||
    pathname === "/hero-counter.jpg" ||
    pathname === "/favicon.ico";

  if (pathname === "/" && session) {
    const dest = session.role === "OWNER" ? "/dashboard" : "/till";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (pathname === "/login" && session) {
    const dest = session.role === "OWNER" ? "/dashboard" : "/till";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    session &&
    session.role === "CASHIER" &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/products"))
  ) {
    return NextResponse.redirect(new URL("/till", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|products/|hero-counter.jpg).*)",
  ],
};
