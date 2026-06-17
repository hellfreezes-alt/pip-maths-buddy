// Cloudflare Pages Function — runs server-side, route: /api/chat
// Holds your Anthropic API key as a secret so it NEVER reaches the browser.
//
// Required environment variables (set these in the Cloudflare dashboard):
//   ANTHROPIC_API_KEY  – your key from console.anthropic.com  (mark as a Secret)
//   APP_PASSCODE       – a passcode you choose; the app must send it to get in
// Optional:
//   PIP_MODEL          – override the model. Default is Sonnet (warmer teaching).
//                        Set to "claude-haiku-4-5-20251001" for the cheapest option.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { system, messages, passcode, name } = body || {};

  // ── gate: reject anyone without the right passcode ──────────────────
  if (!env.APP_PASSCODE || passcode !== env.APP_PASSCODE) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Server is missing ANTHROPIC_API_KEY" }, 500);
  }
  if (!Array.isArray(messages)) {
    return json({ error: "Bad request" }, 400);
  }

  const model = env.PIP_MODEL || "claude-sonnet-4-6";

  // ── memory: load what Pip remembers about this child ────────────────
  let memory = "";
  try {
    if (env.PIP_KV && name) {
      const stored = await env.PIP_KV.get("profile:" + slug(name));
      if (stored) {
        memory =
          `\n\nWHAT YOU REMEMBER ABOUT ${name} (from past sessions — use it naturally to pick up where you left off; do NOT read it out loud):\n${stored}\n`;
      }
    }
  } catch {
    // KV not configured yet — Pip simply works without memory
  }
  const finalSystem = (typeof system === "string" ? system : "") + memory;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: finalSystem,
        messages: messages.slice(-22),
      }),
    });

    const data = await resp.json();
    return json(data, resp.status);
  } catch (e) {
    return json({ error: "Upstream error" }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// turn a child's name into a safe KV key fragment
function slug(name) {
  return String(name || "child").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) || "child";
}
