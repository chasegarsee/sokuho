"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseAuth } from "@/lib/firebaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [fbStatus, setFbStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  const connectFacebook = useCallback(async () => {
    try {
      setFbStatus("starting");
      setError("");
      const auth = getFirebaseAuth();
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch("/fbAuthStart", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Failed to start FB auth");
      }
      const { authUrl } = await resp.json();
      setFbStatus("redirect");
      window.location.href = authUrl;
    } catch (e) {
      setFbStatus("error");
      setError(e.message || "Failed to connect Facebook");
    }
  }, []);

  if (isLoading) return <main className="container"><p>Loading...</p></main>;
  if (!user) return null;

  return (
    <main className="container">
      <h1>Dashboard</h1>
      <p>UID: {user.uid}</p>
      <button onClick={connectFacebook} disabled={fbStatus === "starting"}>
        {fbStatus === "starting" ? "Connecting…" : "Connect Facebook"}
      </button>
      {error ? <p style={{ color: "red" }}>{error}</p> : null}
    </main>
  );
}


