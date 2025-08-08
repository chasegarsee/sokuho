import * as functions from "firebase-functions";
import { hello } from "@repo/shared";

export const ping = functions.https.onRequest((_req, res) => {
  res.json({ ok: true, msg: hello("from Functions") });
});
