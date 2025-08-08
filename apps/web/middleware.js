import { NextResponse } from "next/server";

const protectedRoutes = [/^\/dashboard(\/.*)?$/];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const requiresAuth = protectedRoutes.some((r) => r.test(pathname));
  if (!requiresAuth) return NextResponse.next();

  const sessionCookie = request.cookies.get("__session");
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  // For middleware (edge), we only check cookie presence. Verification happens on server routes/pages.
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};


