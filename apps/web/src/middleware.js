import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";

// Protect routes under /app that require auth
const protectedRoutes = [/^\/dashboard(\/.*)?$/];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const requiresAuth = protectedRoutes.some((r) => r.test(pathname));
  if (!requiresAuth) return NextResponse.next();

  const sessionCookie = request.cookies.get("__session");
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  try {
    const auth = getFirebaseAdminAuth();
    await auth.verifySessionCookie(sessionCookie.value, true);
    return NextResponse.next();
  } catch (e) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};


