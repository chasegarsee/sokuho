import { initializeApp, getApps, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
    return cert(json);
  }
  return applicationDefault();
}

export function getFirebaseAdminApp() {
  if (!getApps().length) {
    initializeApp({
      credential: getCredential(),
      projectId,
    });
  }
  return getApps()[0];
}

export function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  return getAuth(app);
}


