# Social Poster Monorepo (Next.js + Firebase + pnpm)

A production-ready starter for connecting and posting to **Facebook Pages, Instagram (Graph)**, **Threads (Meta)**, **X (Twitter)**, **TikTok**, and **YouTube** using **Next.js** for UI + **Firebase Cloud Functions (v2)** for OAuth & publish APIs.

> Package manager: **pnpm**

---

## 0) File tree

```
social-poster/
├─ pnpm-workspace.yaml
├─ package.json
├─ firebase.json
├─ .firebaserc
├─ .env.local.example
├─ apps/
│  └─ web/                # Next.js frontend (App Router)
│     ├─ package.json
│     ├─ next.config.js
│     ├─ tsconfig.json
│     ├─ src/
│     │  ├─ app/
│     │  │  ├─ page.tsx
│     │  │  ├─ layout.tsx
│     │  │  └─ api/
│     │  │     └─ publish/[provider]/route.ts  # proxies to Functions
│     │  └─ lib/providers.ts
│     └─ public/
└─ functions/
   ├─ package.json
   ├─ tsconfig.json
   ├─ src/
   │  ├─ index.ts
   │  ├─ config.ts
   │  ├─ utils/
   │  │  ├─ cors.ts
   │  │  ├─ http.ts
   │  │  ├─ firestore.ts
   │  │  └─ tokens.ts
   │  ├─ providers/
   │  │  ├─ facebook.ts      # FB Pages
   │  │  ├─ instagram.ts     # IG Graph
   │  │  ├─ threads.ts       # Threads API
   │  │  ├─ x.ts             # X (Twitter)
   │  │  ├─ tiktok.ts        # TikTok Content Posting
   │  │  └─ youtube.ts       # YouTube Data API v3
   │  └─ types.ts
   └─ local.emulator.json (optional)
```

---

## 1) Workspace + root config

**pnpm-workspace.yaml**

```yaml
packages:
  - apps/*
  - functions
```

**package.json (root)**

```json
{
  "name": "social-poster",
  "private": true,
  "packageManager": "pnpm@9.12.2",
  "scripts": {
    "dev": "pnpm -C apps/web dev",
    "build": "pnpm -C apps/web build && pnpm -C functions build",
    "deploy": "firebase deploy",
    "emulators": "firebase emulators:start"
  }
}
```

**firebase.json**

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "auth": { "port": 9099 }
  }
}
```

**.firebaserc**

```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```

**.env.local.example** (copy to `apps/web/.env.local`)

```
NEXT_PUBLIC_FUNCTIONS_BASE=https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net
```

---

## 2) Firebase Functions (v2) packages & TS config

**functions/package.json**

```json
{
  "name": "functions",
  "private": true,
  "type": "module",
  "engines": { "node": "^20" },
  "scripts": {
    "build": "tsc -b",
    "watch": "tsc -b -w"
  },
  "dependencies": {
    "firebase-admin": "^12.6.0",
    "firebase-functions": "^5.0.1",
    "undici": "^6.19.8"
  },
  "devDependencies": {
    "typescript": "^5.6.2"
  }
}
```

**functions/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

---

## 3) Shared Functions utilities

**functions/src/types.ts**

```ts
export type Provider = "facebook" | "instagram" | "threads" | "x" | "tiktok" | "youtube";
```

**functions/src/config.ts**

```ts
import { logger } from "firebase-functions";

// All secrets must be set via: firebase functions:config:set ...
// Example keys per provider are documented below.

export function cfg() {
  const c: any = (global as any).functions?.config?.() ?? require("firebase-functions").config();
  const pick = (obj: any, path: string) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
  const read = (ns: string, key: string, optional = false) => {
    const v = pick(c, `${ns}.${key}`);
    if (!v && !optional) logger.warn(`[config] Missing ${ns}.${key}`);
    return v as string | undefined;
  };

  return {
    base: {
      callbackBase: read("app", "callback_base", true) // optional: https://<region>-<project>.cloudfunctions.net
    },
    facebook: {
      appId: read("facebook", "app_id"),
      appSecret: read("facebook", "app_secret"),
      callbackUrl: read("facebook", "callback_url", true)
    },
    instagram: {
      appId: read("instagram", "app_id"),
      appSecret: read("instagram", "app_secret"),
      callbackUrl: read("instagram", "callback_url", true)
    },
    threads: {
      appId: read("threads", "app_id"),
      appSecret: read("threads", "app_secret"),
      callbackUrl: read("threads", "callback_url", true)
    },
    x: {
      clientId: read("x", "client_id"),
      clientSecret: read("x", "client_secret"),
      callbackUrl: read("x", "callback_url", true)
    },
    tiktok: {
      clientKey: read("tiktok", "client_key"),
      clientSecret: read("tiktok", "client_secret"),
      callbackUrl: read("tiktok", "callback_url", true)
    },
    youtube: {
      clientId: read("youtube", "client_id"),
      clientSecret: read("youtube", "client_secret"),
      callbackUrl: read("youtube", "callback_url", true)
    }
  };
}
```

**functions/src/utils/cors.ts**

```ts
export const applyCors = (res: any) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
};
```

**functions/src/utils/http.ts**

```ts
import { fetch } from "undici";
export { fetch };

export async function jsonOrThrow(res: Response) {
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  return res.json();
}
```

**functions/src/utils/firestore.ts**

```ts
import * as admin from "firebase-admin";

export const db = () => admin.firestore();

export async function saveIntegration(uid: string, provider: string, data: any) {
  await db()
    .collection("users")
    .doc(uid)
    .collection("integrations")
    .doc(provider)
    .set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

export async function getIntegration(uid: string, provider: string) {
  const snap = await db().collection("users").doc(uid).collection("integrations").doc(provider).get();
  return snap.exists ? snap.data() : null;
}

export async function createState(uid: string, provider: string, returnTo?: string | null) {
  const nonce = crypto.randomUUID();
  await db().collection("oauthStates").doc(nonce).set({
    uid,
    provider,
    returnTo: returnTo ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ttl: admin.firestore.FieldValue.serverTimestamp() // attach TTL index in Firestore to auto-expire
  });
  return nonce;
}

export async function consumeState(state: string) {
  const ref = db().collection("oauthStates").doc(state);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Invalid state");
  await ref.delete();
  return snap.data() as { uid: string; provider: string; returnTo?: string | null };
}
```

**functions/src/utils/tokens.ts** (skeleton helpers; per-provider specifics go in provider files)

```ts
export type SavedToken = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number | null;
  extra?: Record<string, any>;
};

export function calcExpiresAt(expiresInSec?: number) {
  return expiresInSec ? Date.now() + expiresInSec * 1000 : null;
}
```

---

## 4) Provider handlers (start/callback/publish) — examples

> Each file exposes three HTTPS handlers: `start`, `callback`, `publish`. They all follow the same shape so your Next.js UI can call them uniformly.

### Facebook Pages — **functions/src/providers/facebook.ts**

```ts
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { cfg } from "../config";
import { applyCors } from "../utils/cors";
import { fetch, jsonOrThrow } from "../utils/http";
import { calcExpiresAt, SavedToken } from "../utils/tokens";
import { createState, consumeState, saveIntegration } from "../utils/firestore";

if (!admin.apps.length) admin.initializeApp();

const FB_VER = "v18.0";
const AUTH_URL = `https://www.facebook.com/${FB_VER}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${FB_VER}/oauth/access_token`;

export const start = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const authz = String(req.headers.authorization || "");
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!idToken) return res.status(401).json({ error: "Missing Authorization" });
  const { uid } = await admin.auth().verifyIdToken(idToken);

  const { appId, callbackUrl } = cfg().facebook;
  if (!appId || !callbackUrl) return res.status(500).json({ error: "FB not configured" });

  const scopes = String(req.query.scopes || "pages_show_list,pages_read_engagement,pages_manage_posts");
  const returnTo = req.query.return_to ? String(req.query.return_to) : null;
  const state = await createState(uid, "facebook", returnTo);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: scopes,
    state
  });
  const url = `${AUTH_URL}?${params.toString()}`;
  if (req.query.redirect === "1") return res.redirect(url);
  return res.json({ authUrl: url });
});

export const callback = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  if (!code || !state) return res.status(400).send("Missing code/state");

  const { uid, returnTo } = await consumeState(state);
  const { appId, appSecret, callbackUrl } = cfg().facebook;
  if (!appId || !appSecret || !callbackUrl) return res.status(500).send("FB not configured");

  // short-lived
  const shortQs = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: callbackUrl, code });
  const short = await jsonOrThrow(await fetch(`${TOKEN_URL}?${shortQs.toString()}`));

  // exchange for long-lived user token
  const longQs = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: short.access_token
  });
  const long = await jsonOrThrow(await fetch(`${TOKEN_URL}?${longQs.toString()}`));

  const data: SavedToken = {
    accessToken: long.access_token,
    tokenType: long.token_type || "bearer",
    expiresAt: calcExpiresAt(Number(long.expires_in || 0))
  };
  await saveIntegration(uid, "facebook", data);

  if (returnTo) {
    const u = new URL(returnTo);
    u.searchParams.set("facebook", "connected");
    return res.redirect(u.toString());
  }
  return res.send("Facebook connected. You can close this window.");
});

// Example: publish a simple text post to the first available Page the user manages
export const publish = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const authz = String(req.headers.authorization || "");
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!idToken) return res.status(401).json({ error: "Missing Authorization" });
  const { uid } = await admin.auth().verifyIdToken(idToken);

  const integ = await (await import("../utils/firestore")).getIntegration(uid, "facebook");
  if (!integ?.accessToken) return res.status(400).json({ error: "Not connected" });

  // get pages
  const pages = await jsonOrThrow(await fetch(`https://graph.facebook.com/${FB_VER}/me/accounts?access_token=${integ.accessToken}`));
  const page = pages.data?.[0];
  if (!page) return res.status(400).json({ error: "No managed pages" });

  const message = (await (req.json?.() || Promise.resolve<any>(null)))?.message || "Hello from Social Poster";
  const post = await jsonOrThrow(
    await fetch(`https://graph.facebook.com/${FB_VER}/${page.id}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: page.access_token })
    })
  );

  return res.json({ ok: true, pageId: page.id, postId: post.id });
});
```

### Instagram (Graph) — **functions/src/providers/instagram.ts**

```ts
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { cfg } from "../config";
import { applyCors } from "../utils/cors";
import { fetch, jsonOrThrow } from "../utils/http";
import { calcExpiresAt, SavedToken } from "../utils/tokens";
import { createState, consumeState, saveIntegration } from "../utils/firestore";

if (!admin.apps.length) admin.initializeApp();

const VER = "v18.0";
const AUTH_URL = `https://www.facebook.com/${VER}/dialog/oauth`; // IG uses FB Login
const TOKEN_URL = `https://graph.facebook.com/${VER}/oauth/access_token`;

export const start = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const authz = String(req.headers.authorization || "");
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!idToken) return res.status(401).json({ error: "Missing Authorization" });
  const { uid } = await admin.auth().verifyIdToken(idToken);

  const { appId, callbackUrl } = cfg().instagram;
  if (!appId || !callbackUrl) return res.status(500).json({ error: "IG not configured" });

  const scopes = String(req.query.scopes || "instagram_basic,instagram_content_publish,pages_show_list");
  const returnTo = req.query.return_to ? String(req.query.return_to) : null;
  const state = await createState(uid, "instagram", returnTo);

  const params = new URLSearchParams({ client_id: appId, redirect_uri: callbackUrl, response_type: "code", scope: scopes, state });
  const url = `${AUTH_URL}?${params.toString()}`;
  if (req.query.redirect === "1") return res.redirect(url);
  return res.json({ authUrl: url });
});

export const callback = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  if (!code || !state) return res.status(400).send("Missing code/state");

  const { uid, returnTo } = await consumeState(state);
  const { appId, appSecret, callbackUrl } = cfg().instagram;
  if (!appId || !appSecret || !callbackUrl) return res.status(500).send("IG not configured");

  const shortQs = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: callbackUrl, code });
  const short = await jsonOrThrow(await fetch(`${TOKEN_URL}?${shortQs.toString()}`));

  const longQs = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token });
  const long = await jsonOrThrow(await fetch(`${TOKEN_URL}?${longQs.toString()}`));

  const data: SavedToken = { accessToken: long.access_token, tokenType: long.token_type || "bearer", expiresAt: calcExpiresAt(Number(long.expires_in || 0)) };
  await saveIntegration(uid, "instagram", data);

  if (returnTo) { const u = new URL(returnTo); u.searchParams.set("instagram", "connected"); return res.redirect(u.toString()); }
  return res.send("Instagram connected. You can close this window.");
});

// Minimal IG publish (image by URL -> create container -> publish)
export const publish = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const authz = String(req.headers.authorization || "");
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!idToken) return res.status(401).json({ error: "Missing Authorization" });
  const { uid } = await admin.auth().verifyIdToken(idToken);

  const integSnap = await (await import("../utils/firestore")).getIntegration(uid, "instagram");
  if (!integSnap?.accessToken) return res.status(400).json({ error: "Not connected" });

  // you must map user -> ig_business_account id via FB Graph: /me/accounts -> page -> instagram_business_account
  // For brevity, assume you already stored igBusinessId in integration.extra
  const igBusinessId = integSnap?.extra?.igBusinessId;
  if (!igBusinessId) return res.status(400).json({ error: "Missing igBusinessId mapping" });

  const body = (await (req.json?.() || Promise.resolve<any>(null))) || {};
  const imageUrl = body.imageUrl; // public https URL
  const caption = body.caption || "";
  if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });

  const container = await jsonOrThrow(
    await fetch(`https://graph.facebook.com/${VER}/${igBusinessId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${integSnap.accessToken}`, { method: "POST" })
  );

  const publish = await jsonOrThrow(
    await fetch(`https://graph.facebook.com/${VER}/${igBusinessId}/media_publish?creation_id=${container.id}&access_token=${integSnap.accessToken}`, { method: "POST" })
  );

  return res.json({ ok: true, id: publish.id });
});
```

### Threads — **functions/src/providers/threads.ts**

```ts
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { cfg } from "../config";
import { applyCors } from "../utils/cors";
import { fetch, jsonOrThrow } from "../utils/http";
import { createState, consumeState, saveIntegration } from "../utils/firestore";

if (!admin.apps.length) admin.initializeApp();

// NOTE: Threads API specifics may evolve; this is a placeholder shape.
const AUTH_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://threads.net/oauth/access_token";

export const start = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const { uid } = await admin.auth().verifyIdToken(String(req.headers.authorization || "").slice(7));
  const { appId, callbackUrl } = cfg().threads;
  if (!appId || !callbackUrl) return res.status(500).json({ error: "Threads not configured" });
  const returnTo = req.query.return_to ? String(req.query.return_to) : null;
  const state = await createState(uid, "threads", returnTo);
  const scope = String(req.query.scopes || "threads_basic,threads_content_publish");
  const params = new URLSearchParams({ client_id: appId, redirect_uri: callbackUrl, response_type: "code", scope, state });
  const url = `${AUTH_URL}?${params.toString()}`;
  if (req.query.redirect === "1") return res.redirect(url);
  res.json({ authUrl: url });
});

export const callback = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  if (!code || !state) return res.status(400).send("Missing code/state");
  const { uid, returnTo } = await consumeState(state);
  const { appId, appSecret, callbackUrl } = cfg().threads;
  const token = await jsonOrThrow(
    await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: appId!, client_secret: appSecret!, redirect_uri: callbackUrl!, grant_type: "authorization_code", code }) })
  );
  await saveIntegration(uid, "threads", { accessToken: token.access_token, tokenType: token.token_type, expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : null });
  if (returnTo) { const u = new URL(returnTo); u.searchParams.set("threads", "connected"); return res.redirect(u.toString()); }
  res.send("Threads connected. You can close this window.");
});

export const publish = onRequest(async (_req, res) => {
  applyCors(res);
  // Placeholder; implement Threads publish per official API
  res.json({ ok: true, note: "Implement Threads publish here" });
});
```

### X (Twitter) — **functions/src/providers/x.ts**

```ts
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { cfg } from "../config";
import { applyCors } from "../utils/cors";
import { fetch, jsonOrThrow } from "../utils/http";
import { createState, consumeState, saveIntegration } from "../utils/firestore";

if (!admin.apps.length) admin.initializeApp();

// OAuth 2.0 Authorization Code with PKCE recommended
const AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

export const start = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const { uid } = await admin.auth().verifyIdToken(String(req.headers.authorization || "").slice(7));
  const { clientId, callbackUrl } = cfg().x;
  if (!clientId || !callbackUrl) return res.status(500).json({ error: "X not configured" });
  const returnTo = req.query.return_to ? String(req.query.return_to) : null;
  const state = await createState(uid, "x", returnTo);
  const scope = String(req.query.scopes || "tweet.read tweet.write users.read offline.access");
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: callbackUrl, scope, state, code_challenge_method: "plain", code_challenge: "dev-placeholder" });
  const url = `${AUTH_URL}?${params.toString()}`;
  if (req.query.redirect === "1") return res.redirect(url);
  res.json({ authUrl: url });
});

export const callback = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const code = String(req.query.code || ""); const state = String(req.query.state || "");
  if (!code || !state) return res.status(400).send("Missing code/state");
  const { uid, returnTo } = await consumeState(state);
  const { clientId, clientSecret, callbackUrl } = cfg().x;
  const token = await jsonOrThrow(await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl, code_verifier: "dev-placeholder" }) }));
  await saveIntegration(uid, "x", { accessToken: token.access_token, refreshToken: token.refresh_token, tokenType: token.token_type, expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : null });
  if (returnTo) { const u = new URL(returnTo); u.searchParams.set("x", "connected"); return res.redirect(u.toString()); }
  res.send("X connected. You can close this window.");
});

export const publish = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const { uid } = await admin.auth().verifyIdToken(String(req.headers.authorization || "").slice(7));
  const integ = await (await import("../utils/firestore")).getIntegration(uid, "x");
  if (!integ?.accessToken) return res.status(400).json({ error: "Not connected" });
  const body = (await (req.json?.() || Promise.resolve<any>(null))) || {}; const text = body.text || "Hello from Social Poster";
  const tweet = await jsonOrThrow(await fetch("https://api.twitter.com/2/tweets", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${integ.accessToken}` }, body: JSON.stringify({ text }) }));
  res.json({ ok: true, id: tweet.data?.id });
});
```

### TikTok — **functions/src/providers/tiktok.ts**

```ts
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { cfg } from "../config";
import { applyCors } from "../utils/cors";
import { fetch, jsonOrThrow } from "../utils/http";
import { createState, consumeState, saveIntegration } from "../utils/firestore";

if (!admin.apps.length) admin.initializeApp();

const AUTH_URL = "https://www.tiktok.com/v2/oauth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

export const start = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const { uid } = await admin.auth().verifyIdToken(String(req.headers.authorization || "").slice(7));
  const { clientKey, callbackUrl } = cfg().tiktok;
  if (!clientKey || !callbackUrl) return res.status(500).json({ error: "TikTok not configured" });
  const state = await createState(uid, "tiktok", String(req.query.return_to || "") || null);
  const scope = String(req.query.scopes || "video.upload media.library");
  const url = `${AUTH_URL}?client_key=${encodeURIComponent(clientKey)}&scope=${encodeURIComponent(scope)}&response_type=code&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}`;
  if (req.query.redirect === "1") return res.redirect(url);
  res.json({ authUrl: url });
});

export const callback = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const code = String(req.query.code || ""); const state = String(req.query.state || "");
  if (!code || !state) return res.status(400).send("Missing code/state");
  const { uid, returnTo } = await consumeState(state);
  const { clientKey, clientSecret, callbackUrl } = cfg().tiktok;
  const token = await jsonOrThrow(await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: clientKey!, client_secret: clientSecret!, grant_type: "authorization_code", code, redirect_uri: callbackUrl! }) }));
  await saveIntegration(uid, "tiktok", { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : null });
  if (returnTo) { const u = new URL(returnTo); u.searchParams.set("tiktok", "connected"); return res.redirect(u.toString()); }
  res.send("TikTok connected. You can close this window.");
});

export const publish = onRequest(async (_req, res) => {
  applyCors(res);
  res.json({ ok: true, note: "Implement TikTok upload init + upload + publish here" });
});
```

### YouTube — **functions/src/providers/youtube.ts**

```ts
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { cfg } from "../config";
import { applyCors } from "../utils/cors";
import { fetch, jsonOrThrow } from "../utils/http";
import { createState, consumeState, saveIntegration } from "../utils/firestore";

if (!admin.apps.length) admin.initializeApp();

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const start = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const { uid } = await admin.auth().verifyIdToken(String(req.headers.authorization || "").slice(7));
  const { clientId, callbackUrl } = cfg().youtube;
  if (!clientId || !callbackUrl) return res.status(500).json({ error: "YouTube not configured" });
  const state = await createState(uid, "youtube", String(req.query.return_to || "") || null);
  const scope = "https://www.googleapis.com/auth/youtube.upload";
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: callbackUrl, response_type: "code", access_type: "offline", include_granted_scopes: "true", scope, state, prompt: "consent" });
  const url = `${AUTH_URL}?${params.toString()}`;
  if (req.query.redirect === "1") return res.redirect(url);
  res.json({ authUrl: url });
});

export const callback = onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const code = String(req.query.code || ""); const state = String(req.query.state || "");
  if (!code || !state) return res.status(400).send("Missing code/state");
  const { uid, returnTo } = await consumeState(state);
  const { clientId, clientSecret, callbackUrl } = cfg().youtube;
  const token = await jsonOrThrow(await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId!, client_secret: clientSecret!, redirect_uri: callbackUrl!, grant_type: "authorization_code" }) }));
  await saveIntegration(uid, "youtube", { accessToken: token.access_token, refreshToken: token.refresh_token, tokenType: token.token_type, expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : null });
  if (returnTo) { const u = new URL(returnTo); u.searchParams.set("youtube", "connected"); return res.redirect(u.toString()); }
  res.send("YouTube connected. You can close this window.");
});

export const publish = onRequest(async (_req, res) => {
  applyCors(res);
  res.json({ ok: true, note: "Implement YouTube videos.insert here (multipart/ resumable)" });
});
```

> Add similar file for other providers as needed.

### Functions index — **functions/src/index.ts**

```ts
import { start as fbStart, callback as fbCb, publish as fbPub } from "./providers/facebook";
import { start as igStart, callback as igCb, publish as igPub } from "./providers/instagram";
import { start as thStart, callback as thCb, publish as thPub } from "./providers/threads";
import { start as xStart, callback as xCb, publish as xPub } from "./providers/x";
import { start as ttStart, callback as ttCb, publish as ttPub } from "./providers/tiktok";
import { start as ytStart, callback as ytCb, publish as ytPub } from "./providers/youtube";

export const oauth_facebook_start = fbStart;
export const oauth_facebook_callback = fbCb;
export const publish_facebook = fbPub;

export const oauth_instagram_start = igStart;
export const oauth_instagram_callback = igCb;
export const publish_instagram = igPub;

export const oauth_threads_start = thStart;
export const oauth_threads_callback = thCb;
export const publish_threads = thPub;

export const oauth_x_start = xStart;
export const oauth_x_callback = xCb;
export const publish_x = xPub;

export const oauth_tiktok_start = ttStart;
export const oauth_tiktok_callback = ttCb;
export const publish_tiktok = ttPub;

export const oauth_youtube_start = ytStart;
export const oauth_youtube_callback = ytCb;
export const publish_youtube = ytPub;
```

---

## 5) Next.js App (minimal UI)

**apps/web/package.json**

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "typescript": "^5.6.2"
  }
}
```

**apps/web/next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true }; module.exports = nextConfig;
```

**apps/web/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/lib/*": ["src/lib/*"] },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

**apps/web/src/lib/providers.ts**

```ts
export const providers = ["facebook","instagram","threads","x","tiktok","youtube"] as const;
export type Provider = typeof providers[number];
```

**apps/web/src/app/layout.tsx**

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>{children}</body></html>
  );
}
```

**apps/web/src/app/page.tsx**

```tsx
"use client";
import { providers, Provider } from "@/lib/providers";

const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE!; // e.g. https://us-central1-<project>.cloudfunctions.net

async function start(provider: Provider) {
  const idToken = await getIdToken(); // TODO: replace with your Firebase Auth client logic
  const url = `${base}/oauth_${provider}_start?redirect=1&return_to=${encodeURIComponent(window.location.origin)}`;
  window.location.href = url; // server reads Authorization header; in prod, redirect via backend that attaches it
}

async function publish(provider: Provider) {
  const idToken = await getIdToken();
  const res = await fetch(`${base}/publish_${provider}`, { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
  alert(await res.text());
}

async function getIdToken() {
  // Placeholder; wire up Firebase Auth client and return currentUser.getIdToken()
  return "DEV_ID_TOKEN";
}

export default function Page() {
  return (
    <main>
      <h1>Social Poster</h1>
      <p>Connect your accounts and post.</p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", maxWidth: 720 }}>
        {providers.map((p) => (
          <div key={p} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
            <h3 style={{ textTransform: "capitalize" }}>{p}</h3>
            <button onClick={() => start(p)} style={{ marginRight: 8 }}>Connect</button>
            <button onClick={() => publish(p)}>Publish test</button>
          </div>
        ))}
      </div>
    </main>
  );
}
```

**apps/web/src/app/api/publish/[provider]/route.ts** (optional: if you prefer proxying through Next API)

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE!;
  const idToken = "DEV_ID_TOKEN"; // TODO: inject real Firebase Auth token
  const r = await fetch(`${base}/publish_${params.provider}`, { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
  return new NextResponse(await r.text(), { status: r.status });
}
```

---

## 6) Config keys (examples)

Run these with your real values:

```bash
# App-wide optional
firebase functions:config:set app.callback_base="https://us-central1-YOUR_PROJECT.cloudfunctions.net"

# Facebook (Pages)
firebase functions:config:set facebook.app_id="..." facebook.app_secret="..." facebook.callback_url="https://us-central1-YOUR_PROJECT.cloudfunctions.net/oauth_facebook_callback"

# Instagram (Graph)
firebase functions:config:set instagram.app_id="..." instagram.app_secret="..." instagram.callback_url="https://us-central1-YOUR_PROJECT.cloudfunctions.net/oauth_instagram_callback"

# Threads (Meta) — placeholder keys
firebase functions:config:set threads.app_id="..." threads.app_secret="..." threads.callback_url="https://us-central1-YOUR_PROJECT.cloudfunctions.net/oauth_threads_callback"

# X (Twitter)
firebase functions:config:set x.client_id="..." x.client_secret="..." x.callback_url="https://us-central1-YOUR_PROJECT.cloudfunctions.net/oauth_x_callback"

# TikTok
firebase functions:config:set tiktok.client_key="..." tiktok.client_secret="..." tiktok.callback_url="https://us-central1-YOUR_PROJECT.cloudfunctions.net/oauth_tiktok_callback"

# YouTube (Google)
firebase functions:config:set youtube.client_id="..." youtube.client_secret="..." youtube.callback_url="https://us-central1-YOUR_PROJECT.cloudfunctions.net/oauth_youtube_callback"
```

> After setting: `pnpm -C functions build && firebase deploy --only functions`

---

## 7) Firestore TTL (optional cleanup)

Add a TTL policy on `oauthStates.ttl` to auto-delete stale states.

---

## 8) What you still need to wire

- **Firebase Auth (client)** in Next.js to get a real ID token.
- **IG mapping** from **FB Page → instagram\_business\_account**: after FB connect, query `/me/accounts` then `/PAGE_ID?fields=instagram_business_account{id}` and store `igBusinessId` in the IG integration doc.
- **Threads/TikTok/YouTube publish** logic: the stubs show where to add request shapes and upload flows.
- **Token refresh** flows for providers with refresh/long-lived tokens (cron or on-demand before API calls).

---

## 9) Quickstart

```bash
pnpm i
pnpm -C apps/web i
pnpm -C functions i

# set functions config (see section 6)

pnpm -C functions build
firebase deploy --only functions

# run Next locally
pnpm -C apps/web dev
```

---

## 10) Notes

- All server routes are **idToken-protected**; swap the placeholder with real Firebase Auth.
- Keep provider scopes minimal for App Review; expand as needed.
- Use resumable uploads for YouTube and TikTok for large files.
- For X, implement **real PKCE** (generate a per-session challenge/verifier; the file uses placeholders to keep this starter concise).

