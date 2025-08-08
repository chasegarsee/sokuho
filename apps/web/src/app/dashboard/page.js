import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";

export default async function DashboardPage() {
  const cookie = cookies().get("__session");
  if (!cookie) redirect("/");
  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifySessionCookie(cookie.value, true);

  return (
    <main className="container">
      <h1>Dashboard</h1>
      <p>UID: {decoded.uid}</p>
    </main>
  );
}


