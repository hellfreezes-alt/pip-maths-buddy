// Cloudflare Pages Function — route: /api/save
// Called when a session ends. Asks Claude to (1) merge today's session into a
// running learner profile and (2) write a short note for the parent. Stores both
// in KV. Needs the PIP_KV namespace bound (see README). Uses Haiku to keep it cheap.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { passcode, name, messages } = body || {};

  if (!env.APP_PASSCODE || passcode !== env.APP_PASSCODE) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Server is missing ANTHROPIC_API_KEY" }, 500);
  }
  // No KV bound? Nothing to remember — succeed quietly so the app still works.
  if (!env.PIP_KV) {
    return json({ parentNote: "", memorySaved: false });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ parentNote: "", memorySaved: false });
  }

  const key = "profile:" + slug(name);
  const logKey = "log:" + slug(name);
  const today = new Date().toISOString().slice(0, 10);

  let oldProfile = "";
  try { oldProfile = (await env.PIP_KV.get(key)) || ""; } catch {}

  const transcript = messages
    .filter((m) => m && !m.hidden && (m.role === "user" || m.role === "assistant"))
    .map((m) => `${m.role === "assistant" ? "Pip" : (name || "Child")}: ${m.content}`)
    .join("\n")
    .slice(0, 8000);

  const model = env.PIP_MEMORY_MODEL || "claude-haiku-4-5-20251001";

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
        max_tokens: 600,
        system: "You maintain a learner profile for a young child's maths tutor. Be concise, warm and accurate. You output ONLY valid JSON — no prose, no code fences.",
        messages: [
          {
            role: "user",
            content:
`Today is ${today}. The child's name is ${name || "the child"} (9, Grade 3).

PREVIOUS PROFILE (may be empty):
<<<
${oldProfile || "(none yet)"}
>>>

TODAY'S SESSION:
${transcript}

Merge today's session into the profile, then write a short note for the parent.

Return ONLY this JSON object and nothing else:
{"profile":"Up to 120 words. What ${name || "the child"} can do confidently, what they're still working on, any approaches/examples/interests that help, and today's date (${today}).","parentNote":"2 to 3 warm sentences for the parent: what ${name || "the child"} worked on today, one genuine win, and one thing to keep an eye on."}`,
          },
        ],
      }),
    });

    const data = await resp.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const parsed = safeParse(text);
    const profile = (parsed && parsed.profile) ? parsed.profile : (oldProfile || `${name || "Child"} — session on ${today}.`);
    const parentNote = (parsed && parsed.parentNote) ? parsed.parentNote : "Nice session today!";

    // save profile
    try { await env.PIP_KV.put(key, profile); } catch {}

    // append to parent log (keep last 30)
    try {
      let log = [];
      const raw = await env.PIP_KV.get(logKey);
      if (raw) { try { log = JSON.parse(raw); } catch {} }
      log.push({ date: today, note: parentNote });
      if (log.length > 30) log = log.slice(-30);
      await env.PIP_KV.put(logKey, JSON.stringify(log));
    } catch {}

    return json({ parentNote, memorySaved: true });
  } catch (e) {
    return json({ parentNote: "", memorySaved: false }, 200);
  }
}

function safeParse(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch { return null; }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function slug(name) {
  return String(name || "child").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) || "child";
}
