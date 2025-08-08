MVP: Next.js + Firebase auth with Facebook linking

Setup

1) Create a Firebase project and enable Authentication providers:
   - Google (used for base sign-in in this MVP)
   - Facebook (for linking)

2) Create a Facebook app and add your OAuth redirect URIs in Firebase Console.

3) Add environment variables in `.env.local` at this app root:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_BASE64=base64_of_service_account_json
```

4) Install deps and run:

```
pnpm install
pnpm dev
```

What it does

- Uses Firebase client SDK for auth and links Facebook via popup
- Persists a server-verified session cookie for middleware-protected routes
- Provides a simple Context API for auth state and actions
