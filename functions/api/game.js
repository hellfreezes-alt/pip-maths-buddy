// Cloudflare Pages Function — route: /api/game
// Loads and saves the child's gamification state (lifetime sparks, sessions,
// topics tried, badges, "used a hint" flag). Pure data, no model call.
// Needs the PIP_KV namespace bound (see README). Without it, the game still
// runs during a session but won't persist between sessions.

const DEFAULT = { totalSparks: 0, coins: 0, sessions: 0, stars: {}, mastered: [], badges: [], streak: 0, lastDate: "" };

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }

  const { passcode, name, action, state } = body || {};

  if (!env.APP_PASSCODE || passcode !== env.APP_PASSCODE) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.PIP_KV) {
    // no store yet — hand back defaults so the app still works
    return json({ state: DEFAULT, persisted: false });
  }

  const key = "game:" + slug(name);

  if (action === "save") {
    const clean = sanitize(state);
    try { await env.PIP_KV.put(key, JSON.stringify(clean)); } catch {}
    return json({ state: clean, persisted: true });
  }

  // default: load
  try {
    const raw = await env.PIP_KV.get(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return json({ state: parsed ? sanitize(parsed) : DEFAULT, persisted: true });
  } catch {
    return json({ state: DEFAULT, persisted: true });
  }
}

function sanitize(s) {
  s = s || {};
  const num = (v, max) => Math.max(0, Math.min(max, Number(v) || 0));
  return {
    totalSparks: num(s.totalSparks, 1e7),
    coins: num(s.coins, 1e7),
    sessions: num(s.sessions, 1e7),
    stars: (s.stars && typeof s.stars === "object")
      ? Object.fromEntries(Object.entries(s.stars).slice(0, 60).map(([k, v]) => [String(k).slice(0, 40), num(v, 3)]))
      : {},
    mastered: Array.isArray(s.mastered) ? s.mastered.filter((m) => typeof m === "string").slice(0, 60) : [],
    badges: Array.isArray(s.badges) ? s.badges.filter((b) => typeof b === "string").slice(0, 60) : [],
    streak: num(s.streak, 1e7),
    lastDate: typeof s.lastDate === "string" ? s.lastDate.slice(0, 10) : "",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function slug(name) {
  return String(name || "child").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) || "child";
}
