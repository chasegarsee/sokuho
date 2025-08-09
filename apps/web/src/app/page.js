"use client";
import { hello } from "@repo/shared";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseAuth } from "@/lib/firebaseClient";

function HomeInner() {
  const { user, isLoading, signInWithGoogle, signOutUser } = useAuth();
  async function startConnect(provider) {
    const auth = getFirebaseAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return alert("Sign in first");
    const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE;
    const startPath = provider === "facebook" ? "/fbAuthStart" : "/igAuthStart";
    const returnTo = encodeURIComponent(window.location.origin);
    const resp = await fetch(`${base || ""}${startPath}?return_to=${returnTo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return alert(await resp.text());
    const { authUrl } = await resp.json();
    window.location.href = authUrl;
  }

  return (
    <main className="container">
      <div className="row">
        <h1>Next.js + Firebase Auth + Facebook MVP</h1>
        <div className="spacer" />
        <a className="btn" href="/dashboard">Dashboard</a>
        {user ? <button className="btn btn-ghost" onClick={signOutUser}>Sign out</button> : null}
      </div>
      <p>{hello("from Shared")}</p>

      <div className="card" style={{ marginTop: 16 }}>
        {isLoading ? (
          <p>Loading...</p>
        ) : user ? (
          <div>
            <p>Signed in as {user.email || user.displayName || user.uid}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => startConnect("facebook")}>Connect Facebook</button>
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => startConnect("instagram")}>Connect Instagram</button>
            </div>
          </div>
        ) : (
          <div className="row">
            <button className="btn btn-primary" onClick={signInWithGoogle}>Sign in with Google</button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Home() { return <HomeInner />; }
