// Cloudflare Pages Function — route: /api/log
// Returns the saved parent notes for a child, newest first.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }

  const { passcode, name } = body || {};

  if (!env.APP_PASSCODE || passcode !== env.APP_PASSCODE) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.PIP_KV) return json({ notes: [] });

  try {
    const raw = await env.PIP_KV.get("log:" + slug(name));
    const log = raw ? JSON.parse(raw) : [];
    return json({ notes: log.slice().reverse() });
  } catch {
    return json({ notes: [] });
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function slug(name) {
  return String(name || "child").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) || "child";
}
