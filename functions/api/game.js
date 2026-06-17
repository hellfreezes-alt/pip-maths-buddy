// Cloudflare Pages Function — route: /api/game
// Loads and saves the child's gamification state (lifetime sparks, sessions,
// topics tried, badges, "used a hint" flag). Pure data, no model call.
// Needs the PIP_KV namespace bound (see README). Without it, the game still
// runs during a session but won't persist between sessions.

const DEFAULT = { totalSparks: 0, sessions: 0, topics: [], badges: [], usedStuck: false, streak: 0, lastDate: "", mastered: [], unitScores: {} };

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
  return {
    totalSparks: Math.max(0, Math.min(100000, Number(s.totalSparks) || 0)),
    sessions: Math.max(0, Math.min(100000, Number(s.sessions) || 0)),
    topics: Array.isArray(s.topics) ? s.topics.filter((t) => typeof t === "string").slice(0, 40) : [],
    badges: Array.isArray(s.badges) ? s.badges.filter((b) => typeof b === "string").slice(0, 60) : [],
    usedStuck: !!s.usedStuck,
    streak: Math.max(0, Math.min(100000, Number(s.streak) || 0)),
    lastDate: typeof s.lastDate === "string" ? s.lastDate.slice(0, 10) : "",
    mastered: Array.isArray(s.mastered) ? s.mastered.filter((m) => typeof m === "string").slice(0, 60) : [],
    unitScores: (s.unitScores && typeof s.unitScores === "object")
      ? Object.fromEntries(Object.entries(s.unitScores).slice(0, 60).map(([k, v]) => [String(k).slice(0, 40), Math.max(0, Math.min(100, Number(v) || 0))]))
      : {},
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function slug(name) {
  return String(name || "child").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) || "child";
}
