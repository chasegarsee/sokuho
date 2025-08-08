#!/usr/bin/env bash
set -euo pipefail

# Usage: ./init-monorepo-js.sh <repo-name> <firebase-project-id>
REPO_NAME="${1:-my-monorepo}"
FB_PROJECT="${2:-your-firebase-project-id}"

mkdir "$REPO_NAME" && cd "$REPO_NAME"
git init

# --- Root setup (use npm to init package.json; pnpm lacks -y consistently) ---
npm init -y >/dev/null
npm i -g pnpm >/dev/null 2>&1 || true
pnpm add -D turbo prettier eslint

# Ensure node engines via Node (avoid jq dependency)
node - <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.engines = { node: "20" };
pkg.private = true;
pkg.scripts = {
  "dev": "turbo run dev --parallel",
  "build": "turbo run build",
  "dev:web": "pnpm --filter web dev",
  "dev:functions": "pnpm --filter @repo/functions dev",
  "deploy:functions": "firebase deploy --only functions"
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
NODE

# Workspaces
cat > pnpm-workspace.yaml <<'YAML'
packages:
  - "apps/*"
  - "packages/*"
YAML

# Turborepo
cat > turbo.json <<'JSON'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**"] },
    "dev": { "cache": false, "persistent": true }
  }
}
JSON

# .gitignore
cat > .gitignore <<'GIT'
node_modules
pnpm-lock.yaml
.DS_Store
apps/web/.next
apps/web/.vercel
firebase-debug.log
*.log
.env*
GIT

# --- Shared package (ESM so both Next.js and Functions can import cleanly) ---
mkdir -p packages/shared
cat > packages/shared/package.json <<'JSON'
{
  "name": "@repo/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "index.js"
}
JSON

cat > packages/shared/index.js <<'JS'
export function hello(name) {
  return `Hello, ${name}!`;
}
JS

# --- Next.js app (JS) ---
mkdir -p apps
pnpm dlx create-next-app@latest apps/web --js --eslint --use-pnpm --app --src-dir --import-alias "@/*"

# use shared pkg in the homepage
cat > apps/web/src/app/page.js <<'JSX'
import { hello } from "@repo/shared";

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Next.js + Firebase Monorepo (JS)</h1>
      <p>{hello("from Shared")}</p>
    </main>
  );
}
JSX

# --- Firebase Functions (ESM) ---
mkdir -p apps/functions
cat > apps/functions/package.json <<'JSON'
{
  "name": "@repo/functions",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "index.js",
  "engines": { "node": "20" },
  "scripts": {
    "dev": "firebase emulators:start --only functions"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.0.0"
  }
}
JSON

cat > apps/functions/index.js <<'JS'
import * as functions from "firebase-functions";
import { hello } from "@repo/shared";

export const ping = functions.https.onRequest((_req, res) => {
  res.json({ ok: true, msg: hello("from Functions") });
});
JS

# --- Firebase config at repo root ---
cat > firebase.json <<JSON
{
  "functions": {
    "source": "apps/functions",
    "runtime": "nodejs20"
  },
  "emulators": {
    "functions": { "port": 5001 },
    "ui": { "enabled": true }
  }
}
JSON

cat > .firebaserc <<JSON
{
  "projects": { "default": "$FB_PROJECT" }
}
JSON

# Install all deps once at root (hoisted)
pnpm install

echo
echo "✅ JavaScript monorepo ready in ./$REPO_NAME"
echo "Next steps:"
echo "  cd $REPO_NAME"
echo "  firebase login && firebase use $FB_PROJECT"
echo "  pnpm dev:web         # Next.js"
echo "  pnpm dev:functions   # Firebase Functions emulator"
echo "  pnpm deploy:functions"
echo
