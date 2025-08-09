export async function GET(req) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      return new Response("Missing code/state", { status: 400 });
    }

    const callback = new URL("https://ttauthcallback-av6mtu24ja-uc.a.run.app/");
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);
    return Response.redirect(callback.toString(), 302);
  } catch (e) {
    return new Response("Internal error", { status: 500 });
  }
}


