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
  const [igStatus, setIgStatus] = useState("idle");
  const [igImageUrl, setIgImageUrl] = useState("");
  const [igCaption, setIgCaption] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE || "";

  const connectFacebook = useCallback(async () => {
    try {
      setFbStatus("starting");
      setError("");
      const auth = getFirebaseAuth();
      const idToken = await auth.currentUser.getIdToken();
      const returnTo = encodeURIComponent(window.location.href);
      const resp = await fetch(`https://fbauthstart-av6mtu24ja-uc.a.run.app?return_to=${returnTo}` , { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` } });
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

  const connectInstagram = useCallback(async () => {
    try {
      setIgStatus("starting");
      setError("");
      const auth = getFirebaseAuth();
      const idToken = await auth.currentUser.getIdToken();
      const returnTo = encodeURIComponent(window.location.href);
      const resp = await fetch(`https://igauthstart-av6mtu24ja-uc.a.run.app?return_to=${returnTo}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` } });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Failed to start IG auth");
      }
      const { authUrl } = await resp.json();
      setIgStatus("redirect");
      window.location.href = authUrl;
    } catch (e) {
      setIgStatus("error");
      setError(e.message || "Failed to connect Instagram");
    }
  }, []);

  const publishFacebook = useCallback(async () => {
    try {
      setError("");
      const auth = getFirebaseAuth();
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch(`${base}/fbPublish`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` } });
      const text = await resp.text();
      if (!resp.ok) throw new Error(text || "Failed to publish");
      alert(text);
    } catch (e) {
      setError(e.message || "Failed to publish Facebook");
    }
  }, [base]);

  const publishInstagram = useCallback(async () => {
    try {
      setError("");
      if (!igImageUrl) return setError("Provide an IG image URL");
      const auth = getFirebaseAuth();
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch(`${base}/igPublish`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ imageUrl: igImageUrl, caption: igCaption }) });
      const text = await resp.text();
      if (!resp.ok) throw new Error(text || "Failed to publish");
      alert(text);
    } catch (e) {
      setError(e.message || "Failed to publish Instagram");
    }
  }, [base, igImageUrl, igCaption]);

  if (isLoading) return <main className="container"><p>Loading...</p></main>;
  if (!user) return null;

  return (
    <main className="container">
      <h1>Dashboard</h1>
      <p>UID: {user.uid}</p>
      <button onClick={connectFacebook} disabled={fbStatus === "starting"}>
        {fbStatus === "starting" ? "Connecting…" : "Connect Facebook"}
      </button>
      <button style={{ marginLeft: 8 }} onClick={connectInstagram} disabled={igStatus === "starting"}>
        {igStatus === "starting" ? "Connecting…" : "Connect Instagram"}
      </button>
      <div style={{ marginTop: 16 }}>
        <button onClick={publishFacebook} className="btn">Publish FB test</button>
      </div>
      <div style={{ marginTop: 16 }}>
        <input type="text" placeholder="Image URL" value={igImageUrl} onChange={(e) => setIgImageUrl(e.target.value)} style={{ width: 320 }} />
        <input type="text" placeholder="Caption (optional)" value={igCaption} onChange={(e) => setIgCaption(e.target.value)} style={{ width: 320, marginLeft: 8 }} />
        <button onClick={publishInstagram} className="btn" style={{ marginLeft: 8 }}>Publish IG image</button>
      </div>
      {error ? <p style={{ color: "red" }}>{error}</p> : null}
    </main>
  );
}


