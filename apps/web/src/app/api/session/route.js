import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(request) {
  try {
    const { idToken } = await request.json();
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const expiresIn = 1000 * 60 * 60 * 24 * 5; // 5 days
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    cookies().set("__session", sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: expiresIn / 1000,
      path: "/",
    });
    return NextResponse.json({ uid: decoded.uid });
  } catch (e) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }
}

export async function DELETE() {
  cookies().delete("__session");
  return NextResponse.json({ ok: true });
}


