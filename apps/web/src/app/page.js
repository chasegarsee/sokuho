"use client";
import { hello } from "@repo/shared";
import { useAuth } from "@/context/AuthContext";

function HomeInner() {
  const { user, isLoading, signInWithGoogle, signOutUser, linkWithFacebook } = useAuth();

  return (
    <main className="container">
      <div className="row">
        <h1>Next.js + Firebase Auth + Facebook MVP</h1>
        <div className="spacer" />
        <a className="btn" href="/dashboard">Dashboard</a>
        {user ? (
          <button className="btn btn-ghost" onClick={signOutUser}>Sign out</button>
        ) : null}
      </div>
      <p>{hello("from Shared")}</p>

      <div className="card" style={{ marginTop: 16 }}>
        {isLoading ? (
          <p>Loading...</p>
        ) : user ? (
          <div>
            <p>Signed in as {user.email || user.displayName || user.uid}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={linkWithFacebook}>Connect Facebook</button>
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
