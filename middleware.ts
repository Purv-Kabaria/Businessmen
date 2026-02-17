import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { UserJwtPayload } from "@/types/user";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    return await protectRoute(request, ["ADMIN"]);
  }

  if (pathname.startsWith("/moderator")) {
    return await protectRoute(request, ["MODERATOR", "ADMIN"]);
  }

  if (pathname === "/stall" || pathname === "/field") {
    return await protectRoute(request, ["MODERATOR", "ADMIN"]);
  }

  return NextResponse.next();
}

async function protectRoute(
  request: NextRequest,
  allowedRoles: string[]
): Promise<NextResponse> {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("[Middleware] JWT_SECRET is not configured");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const decoded = payload as unknown as UserJwtPayload;

    if (!decoded || typeof decoded.role !== "string") {
      console.error("[Middleware] Token missing or invalid role", {
        hasDecoded: !!decoded,
        role: decoded?.role,
        payloadKeys: Object.keys(payload || {}),
      });
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("token");
      return response;
    }

    if (!allowedRoles.includes(decoded.role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("[Middleware] JWT verification failed:", {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : "Unknown",
    });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("token");
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/moderator/:path*", "/stall", "/field"],
};
