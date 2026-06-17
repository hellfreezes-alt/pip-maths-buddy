// Cloudflare Pages Function — route: /api/warmup
// Generates 5 tappable warm-up questions for the chosen topic, pitched at the
// child's level (using her saved profile if KV is on). Returns strict JSON.
// Uses Haiku to keep it cheap.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }

  const { passcode, name, topicLabel, topicBrief, mode, count } = body || {};

  if (!env.APP_PASSCODE || passcode !== env.APP_PASSCODE) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Server missing ANTHROPIC_API_KEY" }, 500);
  }

  // tailor difficulty from memory if available
  let memory = "";
  try {
    if (env.PIP_KV && name) {
      const p = await env.PIP_KV.get("profile:" + slug(name));
      if (p) memory = `\nWhat we know about her so far (pitch the questions to this):\n${p}\n`;
    }
  } catch {}

  const model = env.PIP_WARMUP_MODEL || "claude-haiku-4-5-20251001";
  const isTest = mode === "test";
  const n = Math.max(3, Math.min(Number(count) || 5, 12));

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
        max_tokens: 1600,
        system: isTest
          ? "You write a short, friendly end-of-unit maths check for a 9-year-old (Grade 3). Fair and grade-appropriate — not tricky or mean. You output ONLY valid JSON — no prose, no code fences."
          : "You write warm-up maths questions for a 9-year-old (Grade 3). Easy, friendly, confidence-building. You output ONLY valid JSON — no prose, no code fences.",
        messages: [
          {
            role: "user",
            content:
`Make ${n} multiple-choice ${isTest ? "unit-check" : "warm-up"} questions about: ${topicLabel || "Grade 3 maths"} (${topicBrief || ""}).
${memory}
Rules:
- Grade 3 level. ${isTest ? "Cover the main skills of this unit, easy ones first then a little harder, to check she has really understood it." : "Gentle. Start with the easiest and ramp up only slightly."}
- Each question has 3 answer choices, exactly one correct.
- Keep question text short and clear. Use simple, real examples.
- "why" is a kind one-line explanation of the right answer (max 12 words).

Return ONLY this JSON array, nothing else:
[{"q":"question text","choices":["a","b","c"],"answer":0,"why":"short reason"}, ... ${n} items]`,
          },
        ],
      }),
    });

    const data = await resp.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const questions = validate(safeParse(text), n);
    return json({ questions });
  } catch (e) {
    return json({ questions: [] });
  }
}

function validate(arr, n = 5) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((q) => q && typeof q.q === "string" && Array.isArray(q.choices) && q.choices.length >= 2)
    .slice(0, n)
    .map((q) => ({
      q: String(q.q).slice(0, 200),
      choices: q.choices.slice(0, 4).map((c) => String(c).slice(0, 60)),
      answer: Math.max(0, Math.min((Number(q.answer) || 0), q.choices.length - 1)),
      why: String(q.why || "").slice(0, 90),
    }));
}

function safeParse(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  const a = t.indexOf("["), b = t.lastIndexOf("]");
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch { return null; }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function slug(name) {
  return String(name || "child").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) || "child";
}
