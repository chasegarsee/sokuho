import * as functions from "firebase-functions";
import admin from "firebase-admin";
import crypto from "node:crypto";

if (!admin.apps.length) admin.initializeApp();

const FB_OAUTH_VER = "v18.0";
const FB_OAUTH_URL = `https://www.facebook.com/${FB_OAUTH_VER}/dialog/oauth`;
const FB_TOKEN_URL = `https://graph.facebook.com/${FB_OAUTH_VER}/oauth/access_token`;
const FB_GRAPH = (pathAndQuery) => `https://graph.facebook.com/${FB_OAUTH_VER}/${pathAndQuery}`;

// Hardcoded webhook verify token (for Meta Webhooks validation)
const META_VERIFY_TOKEN = "DEV_VERIFY_TOKEN_CHANGE_ME";

// TEMP hardcoded credentials to unblock testing. Replace with your actual values.
// Later switch back to functions config.
const cfg = () => ({
  facebook: {
    appId: "1021127246600237",
    appSecret: "0756b0b190661f12fbf9339fe2e91a4e",
    callbackUrl: "https://fbauthcallback-av6mtu24ja-uc.a.run.app/",
  },
  instagram: {
    appId: "1021127246600237",
    appSecret: "0756b0b190661f12fbf9339fe2e91a4e",
    callbackUrl: "https://igauthcallback-av6mtu24ja-uc.a.run.app/",
  },
});

const cors = (res) => { 
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

export const ping = functions.https.onRequest(
  { invoker: "public" },
  (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") return res.status(204).end();
    res.json({ ok: true, msg: "pong" });
  }
);

// ===== Facebook: start/callback/publish =====

export const fbAuthStart = functions.https.onRequest(
  { invoker: "public" },
  async (req, res) => {
  try {
    cors(res);
    if (req.method === "OPTIONS") return res.status(204).end();

    const authz = req.headers.authorization || "";
    const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
    if (!idToken) return res.status(401).json({ error: "Missing Authorization" });

    const { appId, callbackUrl } = cfg().facebook || {};
    if (!appId || !callbackUrl) return res.status(500).json({ error: "Facebook not configured" });

    const { uid } = await admin.auth().verifyIdToken(idToken);

    const scopes = String(
      req.query.scopes ||
        "public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts"
    );
    const returnTo = req.query.return_to ? String(req.query.return_to) : null;

    const state = crypto.randomUUID();
    await admin.firestore().collection("oauthStates").doc(state).set({
      uid,
      provider: "facebook",
      returnTo,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: callbackUrl,
      state,
      response_type: "code",
      scope: scopes,
    });

    const authUrl = `${FB_OAUTH_URL}?${params.toString()}`;
    if (req.query.redirect === "1") return res.redirect(authUrl);
    res.json({ authUrl });
  } catch (e) {
    console.error("fbAuthStart", e);
    res.status(500).json({ error: "Internal error" });
  }
});

export const fbAuthCallback = functions.https.onRequest(
  { invoker: "public" },
  async (req, res) => {
  try {
    cors(res);
    if (req.method === "OPTIONS") return res.status(204).end();

    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) return res.status(400).send("Missing code/state");

    const stateRef = admin.firestore().collection("oauthStates").doc(state);
    const snap = await stateRef.get();
    if (!snap.exists) return res.status(400).send("Invalid state");
    const { uid, returnTo } = snap.data();

    const { appId, appSecret, callbackUrl } = cfg().facebook || {};
    if (!appId || !appSecret || !callbackUrl) return res.status(500).send("Facebook not configured");

    // Short-lived token
    const shortQs = new URLSearchParams({
      client_id: appId,
      redirect_uri: callbackUrl,
      client_secret: appSecret,
      code,
    });
    const shortResp = await fetch(`${FB_TOKEN_URL}?${shortQs.toString()}`);
    if (!shortResp.ok) {
      console.error("FB short token", await shortResp.text());
      return res.status(400).send("Failed to exchange code");
    }
    const shortData = await shortResp.json();

    // Exchange for long-lived
    const longQs = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortData.access_token,
    });
    const longResp = await fetch(`${FB_TOKEN_URL}?${longQs.toString()}`);
    if (!longResp.ok) {
      console.error("FB long token", await longResp.text());
      return res.status(400).send("Failed to get long-lived token");
    }
    const longData = await longResp.json();

    const expiresIn = Number(longData.expires_in || 0);
    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

    await admin
      .firestore()
      .collection("users")
      .doc(uid)
      .collection("integrations")
      .doc("facebook")
      .set(
        {
          accessToken: longData.access_token,
          tokenType: longData.token_type || "bearer",
          expiresIn,
          expiresAt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    await stateRef.delete();

    if (returnTo) {
      const url = new URL(returnTo);
      url.searchParams.set("facebook", "connected");
      return res.redirect(url.toString());
    }
    res.send("Facebook connected. You can close this window.");
  } catch (e) {
    console.error("fbAuthCallback", e);
    res.status(500).send("Internal error");
  }
});

export const fbPublish = functions.https.onRequest(
  { invoker: "public" },
  async (req, res) => {
    try {
      cors(res);
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const authz = req.headers.authorization || "";
      const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
      if (!idToken) return res.status(401).json({ error: "Missing Authorization" });
      const { uid } = await admin.auth().verifyIdToken(idToken);

      const integSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("integrations")
        .doc("facebook")
        .get();
      const integ = integSnap.exists ? integSnap.data() : null;
      if (!integ?.accessToken) return res.status(400).json({ error: "Not connected" });

      const pagesResp = await fetch(FB_GRAPH(`me/accounts?access_token=${encodeURIComponent(integ.accessToken)}`));
      if (!pagesResp.ok) return res.status(400).json({ error: await pagesResp.text() });
      const pages = await pagesResp.json();
      const page = pages.data && pages.data[0];
      if (!page) return res.status(400).json({ error: "No managed pages" });

      const message = (req.body && req.body.message) || "Hello from Social Poster";
      const postResp = await fetch(FB_GRAPH(`${page.id}/feed`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, access_token: page.access_token }),
      });
      if (!postResp.ok) return res.status(400).json({ error: await postResp.text() });
      const post = await postResp.json();
      return res.json({ ok: true, pageId: page.id, postId: post.id });
    } catch (e) {
      console.error("fbPublish", e);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ===== Instagram: start/callback/publish =====

const IG_VER = FB_OAUTH_VER; // IG uses FB Graph
const IG_AUTH_URL = `https://www.facebook.com/${IG_VER}/dialog/oauth`;
const IG_TOKEN_URL = `https://graph.facebook.com/${IG_VER}/oauth/access_token`;

export const igAuthStart = functions.https.onRequest(
  { invoker: "public" },
  async (req, res) => {
    try {
      cors(res);
      if (req.method === "OPTIONS") return res.status(204).end();

      const authz = req.headers.authorization || "";
      const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
      if (!idToken) return res.status(401).json({ error: "Missing Authorization" });
      const { uid } = await admin.auth().verifyIdToken(idToken);

      const { appId, callbackUrl } = cfg().instagram || {};
      if (!appId || !callbackUrl) return res.status(500).json({ error: "Instagram not configured" });

      const scopes = String(req.query.scopes || "instagram_basic,instagram_content_publish,pages_show_list");
      const returnTo = req.query.return_to ? String(req.query.return_to) : null;
      const state = crypto.randomUUID();
      await admin.firestore().collection("oauthStates").doc(state).set({
        uid,
        provider: "instagram",
        returnTo,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: scopes,
        state,
      });
      const url = `${IG_AUTH_URL}?${params.toString()}`;
      if (req.query.redirect === "1") return res.redirect(url);
      return res.json({ authUrl: url });
    } catch (e) {
      console.error("igAuthStart", e);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ===== Meta Webhook (Facebook + Instagram) =====
export const metaWebhook = functions.https.onRequest(
  { invoker: "public" },
  async (req, res) => {
    try {
      // Verification challenge
      if (req.method === "GET") {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];
        if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
          return res.status(200).send(String(challenge || ""));
        }
        return res.status(403).send("Forbidden");
      }

      if (req.method === "POST") {
        // Receive and log events. In production, route by object (page/instagram) and handle accordingly
        const body = req.body || {};
        console.log("[metaWebhook] event", JSON.stringify(body));
        return res.status(200).send("OK");
      }

      return res.status(405).send("Method Not Allowed");
    } catch (e) {
      console.error("metaWebhook", e);
      return res.status(500).send("Internal error");
    }
  }
);

export const igAuthCallback = functions.https.onRequest(
  { invoker: "public" },
  async (req, res) => {
    try {
      cors(res);
      if (req.method === "OPTIONS") return res.status(204).end();
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      if (!code || !state) return res.status(400).send("Missing code/state");

      const stateRef = admin.firestore().collection("oauthStates").doc(state);
      const snap = await stateRef.get();
      if (!snap.exists) return res.status(400).send("Invalid state");
      const { uid, returnTo } = snap.data();

      const { appId, appSecret, callbackUrl } = cfg().instagram || {};
      if (!appId || !appSecret || !callbackUrl) return res.status(500).send("Instagram not configured");

      const shortQs = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: callbackUrl, code });
      const shortResp = await fetch(`${IG_TOKEN_URL}?${shortQs.toString()}`);
      if (!shortResp.ok) {
        console.error("IG short token", await shortResp.text());
        return res.status(400).send("Failed to exchange code");
      }
      const short = await shortResp.json();

      const longQs = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token });
      const longResp = await fetch(`${IG_TOKEN_URL}?${longQs.toString()}`);
      if (!longResp.ok) {
        console.error("IG long token", await longResp.text());
        return res.status(400).send("Failed to get long-lived token");
      }
      const long = await longResp.json();

      const expiresIn = Number(long.expires_in || 0);
      const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

      const integRef = admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("integrations")
        .doc("instagram");

      // Attempt to map igBusinessId via FB Graph: /me/accounts -> page -> instagram_business_account
      let igBusinessId = null;
      try {
        const pagesResp = await fetch(FB_GRAPH(`me/accounts?access_token=${encodeURIComponent(long.access_token)}`));
        if (pagesResp.ok) {
          const pages = await pagesResp.json();
          const page = pages.data && pages.data[0];
          if (page?.id) {
            const igResp = await fetch(
              FB_GRAPH(`${page.id}?fields=instagram_business_account%7Bid%7D&access_token=${encodeURIComponent(long.access_token)}`)
            );
            if (igResp.ok) {
              const ig = await igResp.json();
              igBusinessId = ig?.instagram_business_account?.id || null;
            }
          }
        }
      } catch (e) {
        console.warn("IG mapping failed", e);
      }

      await integRef.set(
        {
          accessToken: long.access_token,
          tokenType: long.token_type || "bearer",
          expiresIn,
          expiresAt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          extra: igBusinessId ? { igBusinessId } : admin.firestore.FieldValue.delete(),
        },
        { merge: true }
      );

      await stateRef.delete();

      if (returnTo) {
        const url = new URL(returnTo);
        url.searchParams.set("instagram", "connected");
        return res.redirect(url.toString());
      }
      return res.send("Instagram connected. You can close this window.");
    } catch (e) {
      console.error("igAuthCallback", e);
      res.status(500).send("Internal error");
    }
  }
);

export const igPublish = functions.https.onRequest(
  { invoker: "public" },
  async (req, res) => {
    try {
      cors(res);
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const authz = req.headers.authorization || "";
      const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
      if (!idToken) return res.status(401).json({ error: "Missing Authorization" });
      const { uid } = await admin.auth().verifyIdToken(idToken);

      const integSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("integrations")
        .doc("instagram")
        .get();
      const integ = integSnap.exists ? integSnap.data() : null;
      if (!integ?.accessToken) return res.status(400).json({ error: "Not connected" });

      const igBusinessId = integ?.extra?.igBusinessId;
      if (!igBusinessId) return res.status(400).json({ error: "Missing igBusinessId mapping" });

      const body = req.body || {};
      const imageUrl = body.imageUrl;
      const caption = body.caption || "";
      if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });

      const containerResp = await fetch(
        FB_GRAPH(`${igBusinessId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${encodeURIComponent(integ.accessToken)}`),
        { method: "POST" }
      );
      if (!containerResp.ok) return res.status(400).json({ error: await containerResp.text() });
      const container = await containerResp.json();

      const publishResp = await fetch(
        FB_GRAPH(`${igBusinessId}/media_publish?creation_id=${encodeURIComponent(container.id)}&access_token=${encodeURIComponent(integ.accessToken)}`),
        { method: "POST" }
      );
      if (!publishResp.ok) return res.status(400).json({ error: await publishResp.text() });
      const publish = await publishResp.json();

      return res.json({ ok: true, id: publish.id });
    } catch (e) {
      console.error("igPublish", e);
      res.status(500).json({ error: "Internal error" });
    }
  }
);
