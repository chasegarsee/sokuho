import * as functions from "firebase-functions";
import admin from "firebase-admin";
import crypto from "node:crypto";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const facebookConfig = () => ({
  // appId: functions.config().facebook?.app_id,
  // appSecret: functions.config().facebook?.app_secret,
  appId: "1021127246600237",
  appSecret: "0756b0b190661f12fbf9339fe2e91a4e",
  callbackUrl: "https://fbauthstart-av6mtu24ja-uc.a.run.app"
});

const buildBaseUrl = (req) => {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
};

const buildCallbackUrl = (req) => {
  const { callbackUrl } = facebookConfig();
  if (callbackUrl) return callbackUrl;
  const base = buildBaseUrl(req);
  return `${base}/fbAuthCallback`;
};

export const ping = functions.https.onRequest((_req, res) => {
  res.json({ ok: true, msg: "pong" });
});

export const fbAuthStart = functions.https.onRequest(async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    const authz = req.headers.authorization || "";
    const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Missing Authorization" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const { appId } = facebookConfig();
    if (!appId) return res.status(500).json({ error: "Facebook app not configured" });

    const callbackUrl = "https://fbauthcallback-av6mtu24ja-uc.a.run.app"
    const scopes = (req.query.scopes || "public_profile,email").toString();
    const returnTo = (req.query.return_to || "").toString();

    const nonce = crypto.randomUUID();
    await admin.firestore().collection("oauthStates").doc(nonce).set({
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      provider: "facebook",
      returnTo: returnTo || null,
    });

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: callbackUrl,
      state: nonce,
      response_type: "code",
      scope: scopes,
    });
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;

    if (req.query.redirect === "1") {
      res.redirect(authUrl);
    } else {
      res.json({ authUrl });
    }
  } catch (err) {
    console.error("fbAuthStart error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export const fbAuthCallback = functions.https.onRequest(async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send("Missing code/state");

    const stateSnap = await admin.firestore().collection("oauthStates").doc(state.toString()).get();
    if (!stateSnap.exists) return res.status(400).send("Invalid state");
    const { uid, returnTo } = stateSnap.data();

    const { appId, appSecret } = facebookConfig();
    if (!appId || !appSecret) return res.status(500).send("Facebook app not configured");

    const redirect_uri = buildCallbackUrl(req);

    const tokenParams = new URLSearchParams({
      client_id: appId,
      redirect_uri,
      client_secret: appSecret,
      code: code.toString(),
    });

    const shortResp = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${tokenParams.toString()}`);
    if (!shortResp.ok) {
      const text = await shortResp.text();
      console.error("FB short token error", text);
      return res.status(400).send("Failed to exchange code");
    }
    const shortData = await shortResp.json();

    const longParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortData.access_token,
    });
    const longResp = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${longParams.toString()}`);
    if (!longResp.ok) {
      const text = await longResp.text();
      console.error("FB long token error", text);
      return res.status(400).send("Failed to get long-lived token");
    }
    const longData = await longResp.json();

    const expiresInSec = Number(longData.expires_in || 0);
    const expiresAt = expiresInSec ? Date.now() + expiresInSec * 1000 : null;

    await admin.firestore().collection("users").doc(uid).collection("integrations").doc("facebook").set(
      {
        accessToken: longData.access_token,
        tokenType: longData.token_type || "bearer",
        expiresIn: expiresInSec,
        expiresAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await admin.firestore().collection("oauthStates").doc(state.toString()).delete();

    if (returnTo) {
      const url = new URL(returnTo);
      url.searchParams.set("facebook", "connected");
      res.redirect(url.toString());
    } else {
      res.send("Facebook connected. You can close this window.");
    }
  } catch (err) {
    console.error("fbAuthCallback error", err);
    res.status(500).send("Internal error");
  }
});
