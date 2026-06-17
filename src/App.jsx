import React, { useState, useRef, useEffect } from "react";

// ── Pip · a maths buddy (standalone build) ────────────────────────────
// Talks to your own /api/chat endpoint (a Cloudflare Pages Function),
// which holds the Anthropic key. The key is NEVER in this file.

const C = {
  cream: "#FDF6EC",
  cream2: "#FFEAD0",
  ink: "#2D3047",
  inkSoft: "#6B6A86",
  amber: "#FFB454",
  amberDeep: "#F59222",
  purple: "#6C5CE7",
  purpleSoft: "#EFECFE",
  green: "#0FB58A",
  coral: "#FF7B7B",
  white: "#FFFFFF",
};

// safe localStorage (won't crash if blocked)
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch {} },
  del(k) { try { window.localStorage.removeItem(k); } catch {} },
};

const TOPICS = [
  { key: "diagnostic", label: "Find my starting point", emoji: "✨",
    brief: "doing a gentle, game-like check-up to find out what she already knows. Start very easy (counting, simple adding) and slowly try slightly harder ideas across place value and times tables, watching for where she hesitates. Never call it a test." },
  { key: "place", label: "Tens & hundreds", emoji: "🔢",
    brief: "place value — what the digits in numbers like 247 really mean (hundreds, tens, ones)." },
  { key: "addsub", label: "Adding & taking away", emoji: "➕",
    brief: "addition and subtraction, including carrying and borrowing with 2 and 3 digit numbers." },
  { key: "times", label: "Times tables", emoji: "✖️",
    brief: "times tables up to 12, using groups and skip-counting so she understands what multiplying means." },
  { key: "division", label: "Sharing & dividing", emoji: "🍪",
    brief: "division, shown as sharing things equally into groups." },
  { key: "fractions", label: "Fractions", emoji: "🍕",
    brief: "simple fractions — halves, quarters and thirds — using pizza, chocolate bars and shapes." },
  { key: "money", label: "Money", emoji: "💰",
    brief: "money — adding up coins, making amounts and working out change." },
  { key: "time", label: "Telling time", emoji: "🕒",
    brief: "telling the time on a clock, and o'clock / half past / quarter past." },
  { key: "word", label: "Word problems", emoji: "🧩",
    brief: "word problems — turning a little story into a maths sum, step by step." },
  { key: "shapes", label: "Shapes", emoji: "🔺",
    brief: "2D and 3D shapes and their sides, corners and faces." },
];

// ── gamification: levels + badges ─────────────────────────────────────
const DEFAULT_GAME = { totalSparks: 0, sessions: 0, topics: [], badges: [], usedStuck: false, streak: 0, lastDate: "", mastered: [], unitScores: {} };

// local-date helpers for the daily streak
function localDate(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function isYesterday(prev, today) {
  if (!prev) return false;
  const p = new Date(prev + "T00:00:00");
  const t = new Date(today + "T00:00:00");
  return t - p === 86400000;
}
function computeDailyUpdate(g) {
  const today = localDate();
  let streak;
  if (g.lastDate === today) streak = g.streak || 1;
  else if (isYesterday(g.lastDate, today)) streak = (g.streak || 0) + 1;
  else streak = 1;
  const returning = (g.streak || 0) > 1 && streak === 1 && g.lastDate !== today;
  return { today, streak, returning };
}

// gentle escalating thresholds so early levels come quickly
function computeLevel(total) {
  let level = 1, need = 6, acc = 0;
  while (total >= acc + need) { acc += need; level += 1; need += 2; }
  return { level, into: total - acc, need, pct: Math.round(((total - acc) / need) * 100) };
}

const BADGES = [
  { id: "first_session", emoji: "👣", label: "First Steps", desc: "Finished your very first session", test: (s) => s.sessions >= 1 },
  { id: "brave_tryer", emoji: "🦁", label: "Brave Tryer", desc: "Asked for a hint when stuck — that's brave!", test: (s) => s.usedStuck },
  { id: "spark25", emoji: "✨", label: "Spark Collector", desc: "Earned 25 effort sparks", test: (s) => s.totalSparks >= 25 },
  { id: "explorer", emoji: "🧭", label: "Explorer", desc: "Tried 3 different topics", test: (s) => s.topics.length >= 3 },
  { id: "spark100", emoji: "🌟", label: "Bright Spark", desc: "Earned 100 effort sparks", test: (s) => s.totalSparks >= 100 },
  { id: "stickwithit", emoji: "🍯", label: "Stick With It", desc: "Finished 5 sessions", test: (s) => s.sessions >= 5 },
  { id: "level5", emoji: "✋", label: "High Five", desc: "Reached level 5", test: (s) => computeLevel(s.totalSparks).level >= 5 },
  { id: "allrounder", emoji: "🌈", label: "All-Rounder", desc: "Tried 6 different topics", test: (s) => s.topics.length >= 6 },
  { id: "spark250", emoji: "🏆", label: "Maths Superstar", desc: "Earned 250 effort sparks", test: (s) => s.totalSparks >= 250 },
  { id: "streak3", emoji: "🔥", label: "On a Roll", desc: "Practised 3 days in a row", test: (s) => (s.streak || 0) >= 3 },
  { id: "streak7", emoji: "⚡", label: "Super Streak", desc: "Practised 7 days in a row", test: (s) => (s.streak || 0) >= 7 },
  { id: "half", emoji: "🥈", label: "Halfway Hero", desc: "Mastered 5 units", test: (s) => (s.mastered || []).length >= 5 },
  { id: "champion", emoji: "👑", label: "Maths Champion", desc: "Mastered every unit", test: (s) => (s.mastered || []).length >= UNITS.length },
];

function earnedBadges(stats) {
  return BADGES.filter((b) => b.test(stats)).map((b) => b.id);
}

// ── the guided Grade 3 learning path (units in order) ─────────────────
const UNITS = [
  { key: "u_place", emoji: "🔢", title: "Place Value to 1000",
    brief: "place value to 1000 — reading, writing, comparing and ordering numbers; hundreds, tens and ones; expanded form. Build it concrete→pictorial→abstract with base-ten blocks and pictures." },
  { key: "u_addsub", emoji: "➕", title: "Adding & Subtracting",
    brief: "addition and subtraction within 1000, including regrouping (carrying and borrowing), mental strategies like making tens, and checking answers." },
  { key: "u_times", emoji: "✖️", title: "Times Tables",
    brief: "multiplication as equal groups and arrays; the 2, 3, 4, 5, 6 and 10 times tables; skip-counting; understanding what multiplying means." },
  { key: "u_division", emoji: "➗", title: "Division",
    brief: "division as equal sharing and grouping, relating division to multiplication, and simple division facts." },
  { key: "u_fractions", emoji: "🍕", title: "Fractions",
    brief: "halves, thirds, quarters and other unit fractions of shapes and groups; comparing simple fractions; simple equivalent fractions using pictures." },
  { key: "u_measure", emoji: "📏", title: "Measurement",
    brief: "measuring and comparing length (cm, m), mass (g, kg) and volume (ml, l); reading simple scales." },
  { key: "u_money", emoji: "💰", title: "Money",
    brief: "recognising coins and notes, making and adding amounts, and giving change." },
  { key: "u_time", emoji: "🕒", title: "Telling Time",
    brief: "reading clocks to the hour, half past, quarter past/to and five minutes; am/pm; simple durations." },
  { key: "u_shapes", emoji: "🔺", title: "Shapes & Geometry",
    brief: "naming 2D and 3D shapes and their properties (sides, corners, faces, edges); right angles; simple symmetry." },
  { key: "u_word", emoji: "🧩", title: "Word Problems",
    brief: "solving one- and two-step word problems using everything learned; choosing the right operation; drawing simple bar models." },
];

// strip emoji & spell out maths symbols so the voice reads naturally
function stripForSpeech(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2705}\u{2B50}]/gu, "")
    .replace(/×/g, " times ").replace(/÷/g, " divided by ")
    .replace(/=/g, " equals ").replace(/\+/g, " plus ")
    .replace(/\s+/g, " ")
    .trim();
}

function systemPrompt(buddy, name, topicBrief) {
  return `You are ${buddy}, a warm and patient maths buddy for ${name}, who is 9 years old and in Grade 3 at an international school. ${name} sometimes finds maths hard, so your MOST important job is to make her feel safe, clever and never silly for getting something wrong.

HOW YOU TEACH:
- Be Socratic: guide ${name} to work things out herself with small questions and hints. Do NOT just hand over the answer.
- But never leave her feeling stuck or defeated. After she has tried and you've given about two hints, warmly walk through it together step by step so she always ends on a small win.
- One tiny step at a time. Ask only ONE question per message.
- Keep every message very short: 1 to 3 short sentences, simple words a 9-year-old reads easily.
- Make maths concrete and real: cookies, stickers, coins, building blocks, pizza slices, her own fingers. Turn numbers into pictures she can imagine.
- Celebrate EFFORT and good thinking, not just right answers. "I love how you tried that" matters more than "correct".
- Mistakes are normal and useful. When she's wrong, stay cheerful: "Ooh, so close! Let's peek at it together." Never tell her she is bad at maths.
- A little warmth and the odd emoji is lovely (😊 ⭐ 🍪) but don't overdo it.

READING HER SIGNALS:
- If she says she's stuck or "I don't know": make the step smaller, give a gentle hint, or offer an easier version.
- If she seems frustrated or sad: pause the maths, say something kind, and give her an easy question she can win to rebuild confidence.
- If she says it's too easy: give a slightly trickier question on the same idea.

KEEP IT GRADE 3: numbers up to about 1000, times tables to 12, simple fractions (halves, quarters, thirds), money, time, measuring, shapes and word problems. If she wanders off topic, gently bring her back. If she ever seems upset about something that is not maths, kindly suggest she talk to a grown-up she trusts.

Right now you are helping her with: ${topicBrief}

Use her name sometimes. Begin warmly with a friendly hello and one easy first question.`;
}

// Friendly illustrated teacher "Pip". Not a real person. Moods: idle | thinking | talking.
// Colours are easy to change — see SKIN / HAIR / SHIRT below.
const SKIN = "#E8B48F", SKIN_SH = "#D89E76", HAIR = "#46342A", SHIRT = "#6C5CE7";
function Pip({ mood = "idle", size = 64 }) {
  const thinking = mood === "thinking";
  const talking = mood === "talking";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
      {/* soft avatar disc + active-speaker glow */}
      <circle cx="50" cy="50" r="48" fill="#FFF3E0" />
      <circle cx="50" cy="50" r="47" fill="none" stroke={talking ? "#FFCD79" : "#F4E6CC"} strokeWidth="2"
        className={talking ? "pip-ring" : ""} />
      <clipPath id="pipClip"><circle cx="50" cy="50" r="46" /></clipPath>
      <g clipPath="url(#pipClip)">
        {/* shoulders / shirt */}
        <path d="M18 100 C20 78 34 70 50 70 C66 70 80 78 82 100 Z" fill={SHIRT} />
        <path d="M50 70 L44 84 L50 92 L56 84 Z" fill="#fff" opacity="0.95" />
        {/* neck */}
        <rect x="44" y="60" width="12" height="14" rx="5" fill={SKIN_SH} />
        {/* long hair (behind head) */}
        <path d="M24 44 C20 60 22 78 26 92 L34 92 C30 78 30 60 32 50 C30 47 28 46 26 46 Z" fill={HAIR} />
        <path d="M76 44 C80 60 78 78 74 92 L66 92 C70 78 70 60 68 50 C70 47 72 46 74 46 Z" fill={HAIR} />
        {/* head */}
        <ellipse cx="50" cy="45" rx="20" ry="22" fill={SKIN} />
        {/* ears */}
        <circle cx="30" cy="46" r="4" fill={SKIN} />
        <circle cx="70" cy="46" r="4" fill={SKIN} />
        {/* hair top + fringe */}
        <path d="M27 46 C24 22 44 16 50 16 C56 16 76 22 73 46 C73 35 64 29 50 29 C36 29 27 35 27 46 Z" fill={HAIR} />
        <path d="M27 47 C26 38 30 31 35 28 C31 34 32 41 32 47 Z" fill={HAIR} />
        <path d="M73 47 C74 38 70 31 65 28 C69 34 68 41 68 47 Z" fill={HAIR} />
        {/* little hair clip */}
        <circle cx="64" cy="30" r="2.4" fill="#FF7B7B" />
        {/* cheeks */}
        <circle cx="37" cy="50" r="4" fill="#FF9F6E" opacity="0.4" />
        <circle cx="63" cy="50" r="4" fill="#FF9F6E" opacity="0.4" />
        {/* eyebrows */}
        <path d={thinking ? "M37 35 q5 -3 9 -1" : "M37 36 q5 -2 9 0"} stroke={HAIR} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d={thinking ? "M54 34 q5 -2 9 1" : "M54 36 q5 -2 9 0"} stroke={HAIR} strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* glasses (teacherly) */}
        <g stroke={C.ink} strokeWidth="1.6" fill="none" opacity="0.85">
          <rect x="34" y="40" width="13" height="10" rx="5" />
          <rect x="53" y="40" width="13" height="10" rx="5" />
          <line x1="47" y1="44" x2="53" y2="44" />
        </g>
        {/* eyes */}
        {thinking ? (
          <>
            <path d="M38 44 q3 -3 6 0" stroke={C.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M56 44 q3 -3 6 0" stroke={C.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="41" cy="45" r="2.4" fill={C.ink} />
            <circle cx="59" cy="45" r="2.4" fill={C.ink} />
          </>
        )}
        {/* mouth */}
        {talking ? (
          <ellipse cx="50" cy="57" rx="5" ry="3.6" fill="#7A3B3B" className="pip-mouth" style={{ transformOrigin: "50px 57px" }} />
        ) : thinking ? (
          <circle cx="50" cy="57" r="2.4" fill="#7A3B3B" />
        ) : (
          <path d="M43 56 q7 7 14 0" stroke="#7A3B3B" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}

// Teacher Pip surrounded by little star friends — more as she levels up
function PipScene({ level = 1, size = 96 }) {
  const friends = Math.min(Math.max(level - 1, 0), 6);
  const r = size * 0.62;
  return (
    <div style={{ position: "relative", width: size * 2.0, height: size * 1.5, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: friends }).map((_, i) => {
        const ang = (-150 + (i * 300) / Math.max(friends - 1, 1)) * (Math.PI / 180);
        return (
          <div key={i} className="pip-float" style={{ position: "absolute", left: `calc(50% + ${Math.cos(ang) * r}px)`, top: `calc(50% + ${Math.sin(ang) * r * 0.7}px)`, transform: "translate(-50%,-50%)", fontSize: size * 0.22 }}>
            ⭐
          </div>
        );
      })}
      <div className="pip-float"><Pip size={size} /></div>
    </div>
  );
}

function LevelBar({ total }) {
  const { level, into, need, pct } = computeLevel(total);
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.ink, fontSize: 15 }}>Level {level}</span>
        <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 700 }}>{need - into} ✨ to next</span>
      </div>
      <div style={{ height: 14, borderRadius: 999, background: "#F1E6D2", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${C.amber}, ${C.amberDeep})`, transition: "width .5s ease" }} />
      </div>
    </div>
  );
}

export default function MathsBuddy() {
  const [stage, setStage] = useState("gate"); // gate | setup | chat
  const [passcode, setPasscode] = useState("");
  const [pcInput, setPcInput] = useState("");
  const [gateError, setGateError] = useState("");
  const [name, setName] = useState("");
  const [buddyName, setBuddyName] = useState("Pip");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sparks, setSparks] = useState(0);
  const [showGrownups, setShowGrownups] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parentNote, setParentNote] = useState("");
  const [progress, setProgress] = useState(null); // null = not loaded
  const [progressLoading, setProgressLoading] = useState(false);
  // gamification
  const [game, setGame] = useState(DEFAULT_GAME);
  const [showStickers, setShowStickers] = useState(false);
  const [usedStuckSession, setUsedStuckSession] = useState(false);
  const [topicsSession, setTopicsSession] = useState([]);
  const [levelUp, setLevelUp] = useState(null); // {from, to} or null
  const [newBadges, setNewBadges] = useState([]);
  const [streakInfo, setStreakInfo] = useState(null); // {streak, returning}
  // warm-up
  const [warmupQs, setWarmupQs] = useState([]);
  const [wIdx, setWIdx] = useState(0);
  const [wPick, setWPick] = useState(null); // index tapped, or null
  const [wCorrect, setWCorrect] = useState(0);
  const [warmupLoading, setWarmupLoading] = useState(false);
  const [quizMode, setQuizMode] = useState("warmup"); // "warmup" | "unittest"
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [unitResult, setUnitResult] = useState(null);
  // voice
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const lastSpokenRef = useRef(-1);
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);
  const speechSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const scrollRef = useRef(null);

  useEffect(() => {
    const id = "pip-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&family=Nunito:wght@400;600;700&display=swap";
      document.head.appendChild(l);
    }
    // remember passcode + name on this device so she doesn't re-type each time
    const savedPc = store.get("pip_pc");
    const savedName = store.get("pip_name");
    if (savedName) setName(savedName);
    const savedBuddy = store.get("pip_buddy");
    if (savedBuddy) setBuddyName(savedBuddy);
    if (savedPc) { setPasscode(savedPc); setStage("setup"); }
    if (store.get("pip_muted") === "1") setMuted(true);
    // warm up the voice list (some browsers load voices async)
    try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch {}
  }, []);

  function pickVoice() {
    try {
      const vs = window.speechSynthesis.getVoices() || [];
      const en = vs.filter((v) => /^en/i.test(v.lang));
      // best natural female voices across iOS / macOS / Windows / Chrome, in order
      const preferred = [
        /Google UK English Female/i,
        /Microsoft (Aria|Jenny|Sonia|Libby|Michelle)[^]*Natural/i,
        /Microsoft (Aria|Jenny|Sonia|Libby|Michelle)/i,
        /Samantha/i, /Serena/i, /Karen/i, /Moira/i, /Tessa/i, /Fiona/i, /Catherine/i,
        /Google US English/i,
        /female/i,
      ];
      for (const re of preferred) {
        const m = en.find((v) => re.test(v.name));
        if (m) return m;
      }
      // avoid obviously male-named voices if we can
      const notMale = en.find((v) => !/(male|daniel|fred|alex|arthur|oliver|george|james|guy|david)/i.test(v.name));
      return notMale || en[0] || vs[0] || null;
    } catch { return null; }
  }

  function speak(text) {
    const clean = stripForSpeech(text);
    if (!clean) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 0.94; u.pitch = 1.12;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    } catch {}
  }

  function stopSpeak() {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
    setSpeaking(false);
  }

  function startListening() {
    if (listening) { try { recogRef.current && recogRef.current.stop(); } catch {} return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    stopSpeak(); // don't record Pip's own voice
    let rec = recogRef.current;
    if (!rec) {
      rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      recogRef.current = rec;
    }
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput(txt);
      if (e.results[e.results.length - 1].isFinal) {
        setListening(false);
        const finalTxt = txt.trim();
        if (finalTxt) setTimeout(() => send(finalTxt), 150);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      store.set("pip_muted", next ? "1" : "0");
      if (next) stopSpeak();
      return next;
    });
  }

  // speak each new message from Pip (unless muted)
  useEffect(() => {
    if (muted) return;
    const i = messages.length - 1;
    if (i < 0) return;
    const m = messages[i];
    if (m && m.role === "assistant" && i !== lastSpokenRef.current) {
      lastSpokenRef.current = i;
      speak(m.content);
    }
  }, [messages, muted]);

  // speak the current warm-up question when it appears
  useEffect(() => {
    if (stage === "warmup" && !muted && wPick === null && warmupQs[wIdx]) {
      speak(warmupQs[wIdx].q);
    }
    // eslint-disable-next-line
  }, [stage, wIdx, warmupQs, muted]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function callPip(history, currentTopic) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode,
          name,
          system: systemPrompt(buddyName || "Pip", name || "your friend", currentTopic.brief),
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (res.status === 401) {
        store.del("pip_pc");
        setPasscode("");
        setGateError("That passcode didn't work. Please try again.");
        setStage("gate");
        return;
      }
      if (!res.ok) throw new Error("net");
      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      setMessages([...history, { role: "assistant", content: text || "Hmm, let me think about that again. Can you say it once more? 😊" }]);
    } catch (e) {
      setError(`${buddyName || "Pip"} lost the connection for a moment.`);
    } finally {
      setLoading(false);
    }
  }

  function submitGate() {
    const v = pcInput.trim();
    if (!v) return;
    setPasscode(v);
    store.set("pip_pc", v);
    setGateError("");
    setStage("setup");
  }

  function resetForSession(t) {
    stopSpeak();
    lastSpokenRef.current = -1;
    setSparks(0);
    setUsedStuckSession(false);
    setTopicsSession([t.key]);
    setLevelUp(null);
    setNewBadges([]);
    loadGame(name);
  }

  function begin(selected) {
    const t = selected || topic;
    setTopic(t);
    if (name.trim()) store.set("pip_name", name.trim());
    store.set("pip_buddy", (buddyName || "Pip").trim());
    resetForSession(t);
    setStage("chat");
    const trigger = {
      role: "user", hidden: true,
      content: `[${name || "The student"} just chose to work on: ${t.label}. Greet her warmly by name and start with one easy, friendly first question.]`,
    };
    const next = [trigger];
    setMessages(next);
    callPip(next, t);
  }

  async function startWarmup(selected) {
    const t = selected || topic;
    setTopic(t);
    if (name.trim()) store.set("pip_name", name.trim());
    store.set("pip_buddy", (buddyName || "Pip").trim());
    resetForSession(t);
    setQuizMode("warmup");
    await runQuiz({ label: t.label, brief: t.brief, mode: "warmup", onEmpty: () => begin(t) });
  }

  async function runQuiz({ label, brief, mode, onEmpty }) {
    setWarmupQs([]);
    setWIdx(0);
    setWPick(null);
    setWCorrect(0);
    setWarmupLoading(true);
    setStage("warmup");
    try {
      const res = await fetch("/api/warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, name, topicLabel: label, topicBrief: brief, mode, count: 5 }),
      });
      const data = res.ok ? await res.json() : { questions: [] };
      if (!data.questions || data.questions.length === 0) { onEmpty && onEmpty(); return; }
      setWarmupQs(data.questions);
    } catch {
      onEmpty && onEmpty();
    } finally {
      setWarmupLoading(false);
    }
  }

  // ── learning path ──
  function goToPath() {
    stopSpeak();
    setSparks(0);
    setLevelUp(null);
    setNewBadges([]);
    setStreakInfo(null);
    setUnitResult(null);
    setStage("path");
  }
  function openPath() {
    if (!name.trim()) return;
    store.set("pip_name", name.trim());
    store.set("pip_buddy", (buddyName || "Pip").trim());
    loadGame(name);
    goToPath();
  }
  function openUnit(unit) {
    setSelectedUnit(unit);
    setStage("unit");
  }
  function learnUnit(unit) {
    begin({ key: unit.key, label: unit.title, emoji: unit.emoji, brief: unit.brief });
  }
  function startUnitTest(unit) {
    setSelectedUnit(unit);
    setQuizMode("unittest");
    stopSpeak();
    setSparks(0);
    setUsedStuckSession(false);
    setLevelUp(null);
    setNewBadges([]);
    runQuiz({ label: unit.title, brief: unit.brief, mode: "test", onEmpty: () => setStage("unit") });
  }

  function finishUnitTest() {
    const total = warmupQs.length;
    const correct = wCorrect;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const passed = total > 0 && correct / total >= 0.8;
    const { today, streak, returning } = computeDailyUpdate(game);
    const masteredSet = new Set(game.mastered || []);
    const newlyMastered = passed && !masteredSet.has(selectedUnit.key);
    if (passed) masteredSet.add(selectedUnit.key);
    const unitScores = { ...(game.unitScores || {}) };
    unitScores[selectedUnit.key] = Math.max(unitScores[selectedUnit.key] || 0, pct);

    const updated = {
      totalSparks: game.totalSparks + sparks,
      sessions: game.sessions + 1,
      topics: Array.from(new Set([...(game.topics || []), selectedUnit.key])),
      usedStuck: game.usedStuck,
      streak,
      lastDate: today,
      mastered: Array.from(masteredSet),
      unitScores,
    };
    const before = computeLevel(game.totalSparks).level;
    const after = computeLevel(updated.totalSparks).level;
    const prevBadges = game.badges || [];
    const now = earnedBadges(updated);
    updated.badges = now;

    setLevelUp(after > before ? { from: before, to: after } : null);
    setNewBadges(now.filter((id) => !prevBadges.includes(id)));
    setStreakInfo({ streak, returning });
    setUnitResult({ correct, total, pct, passed, newlyMastered });
    setGame(updated);
    saveGameState(updated);
    setStage("unitresult");
  }

  function answerWarmup(choiceIdx) {
    if (wPick !== null) return; // already answered this one
    const q = warmupQs[wIdx];
    const correct = choiceIdx === q.answer;
    setWPick(choiceIdx);
    setSparks((s) => s + 1 + (correct ? 1 : 0)); // a spark for trying, bonus for correct
    if (correct) setWCorrect((c) => c + 1);
    if (!muted) speak((correct ? "Yes! Nice one. " : "Good try. ") + (q.why || ""));
  }

  function nextWarmup() {
    if (wIdx + 1 < warmupQs.length) {
      setWIdx((i) => i + 1);
      setWPick(null);
    } else if (quizMode === "unittest") {
      finishUnitTest();
    } else {
      flowIntoChat();
    }
  }

  function flowIntoChat() {
    const t = topic;
    const score = `${wCorrect} out of ${warmupQs.length}`;
    stopSpeak();
    lastSpokenRef.current = -1;
    setStage("chat");
    const trigger = {
      role: "user", hidden: true,
      content: `[${name || "The student"} just finished a quick warm-up on ${t.label} and got ${score} right. Greet her warmly by name, say something encouraging about the warm-up, then start the lesson with one friendly question — go a little gentler if she found the warm-up tricky.]`,
    };
    const next = [trigger];
    setMessages(next);
    callPip(next, t);
  }

  function switchTopic(t) {
    if (t.key === topic.key || loading) return;
    setTopic(t);
    setTopicsSession((prev) => Array.from(new Set([...prev, t.key])));
    const trigger = {
      role: "user", hidden: true,
      content: `[${name || "The student"} now wants to switch to: ${t.label}. Say something cheerful about the new topic and start with one easy question.]`,
    };
    const next = [...messages, trigger];
    setMessages(next);
    callPip(next, t);
  }

  function send(text) {
    const value = (text ?? input).trim();
    if (!value || loading) return;
    const next = [...messages, { role: "user", content: value }];
    setMessages(next);
    setInput("");
    setSparks((s) => s + 1);
    callPip(next, topic);
  }

  function retry() { setError(null); callPip(messages, topic); }

  async function loadGame(forName) {
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, name: forName ?? name, action: "load" }),
      });
      const data = res.ok ? await res.json() : null;
      setGame(data && data.state ? { ...DEFAULT_GAME, ...data.state } : DEFAULT_GAME);
    } catch {
      setGame(DEFAULT_GAME);
    }
  }

  function saveGameState(updated) {
    fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, name, action: "save", state: updated }),
    }).catch(() => {});
  }

  async function finishSession() {
    if (saving) return;
    stopSpeak();
    setSaving(true);

    // ── update the game from this session ──
    const { today, streak, returning } = computeDailyUpdate(game);
    setStreakInfo({ streak, returning });

    const updated = {
      totalSparks: game.totalSparks + sparks,
      sessions: game.sessions + 1,
      topics: Array.from(new Set([...(game.topics || []), ...topicsSession])),
      usedStuck: game.usedStuck || usedStuckSession,
      streak,
      lastDate: today,
      mastered: game.mastered || [],
      unitScores: game.unitScores || {},
    };
    const before = computeLevel(game.totalSparks).level;
    const after = computeLevel(updated.totalSparks).level;
    const prev = game.badges || [];
    const now = earnedBadges(updated);
    updated.badges = now;
    setLevelUp(after > before ? { from: before, to: after } : null);
    setNewBadges(now.filter((id) => !prev.includes(id)));
    setGame(updated);
    saveGameState(updated);

    setStage("wrapup");
    setParentNote("");
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, name, messages }),
      });
      if (res.ok) {
        const data = await res.json();
        setParentNote(data.parentNote || "");
      }
    } catch {
      // memory save is best-effort; the wrap-up still shows
    } finally {
      setSaving(false);
    }
  }

  function newSession() {
    stopSpeak();
    lastSpokenRef.current = -1;
    setMessages([]);
    setSparks(0);
    setParentNote("");
    setProgress(null);
    setLevelUp(null);
    setNewBadges([]);
    setStreakInfo(null);
    setUsedStuckSession(false);
    setTopicsSession([]);
    setStage("setup");
  }

  async function loadProgress() {
    setProgressLoading(true);
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, name }),
      });
      const data = res.ok ? await res.json() : { notes: [] };
      setProgress(data.notes || []);
    } catch {
      setProgress([]);
    } finally {
      setProgressLoading(false);
    }
  }

  const visible = messages.filter((m) => !m.hidden);

  // ── Passcode gate ──────────────────────────────────────────────────
  if (stage === "gate") {
    return (
      <div style={wrap}>
        <Style />
        <div style={{ ...card, maxWidth: 420 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <div className="pip-float"><Pip size={84} /></div>
          </div>
          <h1 style={h1}>Welcome back!</h1>
          <p style={{ ...sub, marginTop: 2 }}>Pop in the secret word to start.</p>
          <input
            value={pcInput}
            onChange={(e) => setPcInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitGate()}
            placeholder="Secret word…"
            type="password"
            style={{ ...textInput, marginTop: 18 }}
          />
          {gateError && <p style={{ color: C.coral, fontSize: 13.5, margin: "10px 2px 0", fontWeight: 700 }}>{gateError}</p>}
          <button onClick={submitGate} disabled={!pcInput.trim()} className="pip-cta"
            style={{ ...cta, opacity: pcInput.trim() ? 1 : 0.5, cursor: pcInput.trim() ? "pointer" : "not-allowed" }}>
            Let me in →
          </button>
        </div>
      </div>
    );
  }

  // ── Setup ──────────────────────────────────────────────────────────
  if (stage === "setup") {
    return (
      <div style={wrap}>
        <Style />
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <div className="pip-float"><Pip size={92} /></div>
          </div>
          <h1 style={h1}>Hi, I'm {buddyName || "Pip"}!</h1>
          <p style={{ ...sub, marginTop: 2 }}>
            Your friendly maths buddy. We'll figure things out together, one little
            step at a time — and mistakes are totally allowed. 🌟
          </p>

          <label style={fieldLabel}>What's your name?</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && begin()}
            placeholder="Type your name…" style={textInput} maxLength={20} />

          <label style={{ ...fieldLabel, marginTop: 18 }}>What should you call your teacher?</label>
          <input value={buddyName} onChange={(e) => setBuddyName(e.target.value)}
            placeholder="e.g. Pip, Maya, Mr Bright…" style={textInput} maxLength={16} />
          <p style={{ fontSize: 12, color: C.inkSoft, margin: "6px 2px 0" }}>You can pick any name you like! ✨</p>

          <button onClick={openPath} disabled={!name.trim()} className="pip-cta"
            style={{ ...cta, marginTop: 20, opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? "pointer" : "not-allowed" }}>
            📚 Open Learning Path →
          </button>
          <p style={{ fontSize: 12.5, color: C.inkSoft, textAlign: "center", margin: "12px 0 4px" }}>— or just explore a topic —</p>

          <p style={{ ...fieldLabel, marginTop: 18 }}>What shall we start with?</p>
          <div style={chipWrap}>
            {TOPICS.map((t) => {
              const active = t.key === topic.key;
              return (
                <button key={t.key} onClick={() => setTopic(t)} className="pip-chip"
                  style={{ ...chip, background: active ? C.purple : C.white, color: active ? C.white : C.ink, borderColor: active ? C.purple : "#EADFCB" }}>
                  <span style={{ marginRight: 6 }}>{t.emoji}</span>{t.label}
                </button>
              );
            })}
          </div>

          <button onClick={() => name.trim() && begin()} disabled={!name.trim()} className="pip-cta"
            style={{ ...cta, opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? "pointer" : "not-allowed" }}>
            Let's go! →
          </button>

          <button onClick={() => name.trim() && startWarmup()} disabled={!name.trim()} className="pip-cta"
            style={{ ...ctaAlt, opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? "pointer" : "not-allowed" }}>
            🔥 Quick warm-up first
          </button>

          <button
            onClick={() => { const next = !showStickers; setShowStickers(next); if (next && name.trim()) loadGame(name); }}
            disabled={!name.trim()}
            style={{ ...grownToggle, color: C.purple, opacity: name.trim() ? 1 : 0.5 }}>
            ⭐ My sticker book
          </button>
          {showStickers && name.trim() && <StickerBook game={game} />}

          <button onClick={() => setShowGrownups((s) => !s)} style={grownToggle}>👀 For grown-ups</button>
          {showGrownups && (
            <GrownupsNote
              buddyName={buddyName || "Pip"}
              progress={progress}
              progressLoading={progressLoading}
              onLoadProgress={loadProgress}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Learning Path map ──────────────────────────────────────────────
  if (stage === "path") {
    const masteredSet = new Set(game.mastered || []);
    const currentIdx = UNITS.findIndex((u) => !masteredSet.has(u.key));
    const doneCount = masteredSet.size;
    return (
      <div style={wrap}>
        <Style />
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <button onClick={() => setStage("setup")} className="pip-help" style={doneBtn}>← Back</button>
            <div style={{ flex: 1, textAlign: "center", fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 20, color: C.ink }}>📚 Learning Path</div>
            <div style={{ width: 56 }} />
          </div>
          <p style={{ ...sub, marginTop: 0, marginBottom: 12 }}>{doneCount} of {UNITS.length} units mastered 🏅</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {UNITS.map((u, i) => {
              const mastered = masteredSet.has(u.key);
              const current = !mastered && (currentIdx === i);
              const locked = !mastered && !current;
              const best = (game.unitScores || {})[u.key];
              return (
                <button key={u.key} disabled={locked} onClick={() => !locked && openUnit(u)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%",
                    padding: "13px 14px", borderRadius: 16, cursor: locked ? "default" : "pointer",
                    border: current ? `2px solid ${C.purple}` : "1.5px solid #EADFCB",
                    background: locked ? "#F4EEE3" : current ? C.purpleSoft : C.white,
                    opacity: locked ? 0.6 : 1,
                  }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: mastered ? "#FFF1D6" : current ? C.purple : "#ECE3D3", color: "#fff" }}>
                    {mastered ? "🏅" : locked ? "🔒" : <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700 }}>{i + 1}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.ink, fontSize: 15 }}>{u.emoji} {u.title}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>
                      {mastered ? `Mastered${best ? ` · best ${best}%` : ""} — tap to revisit` : current ? "Start here →" : "Locked"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {doneCount === UNITS.length && (
            <div className="pip-pop" style={{ ...levelUpCard, textAlign: "center", marginTop: 14 }}>
              👑 You mastered every unit — you're a Maths Champion!
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Unit detail ────────────────────────────────────────────────────
  if (stage === "unit" && selectedUnit) {
    const mastered = (game.mastered || []).includes(selectedUnit.key);
    const best = (game.unitScores || {})[selectedUnit.key];
    return (
      <div style={wrap}>
        <Style />
        <div style={{ ...card, textAlign: "center" }}>
          <button onClick={() => setStage("path")} className="pip-help" style={{ ...doneBtn, float: "left" }}>← Path</button>
          <div style={{ fontSize: 46, marginTop: 8 }}>{selectedUnit.emoji}</div>
          <h1 style={{ ...h1, fontSize: 25 }}>{selectedUnit.title}</h1>
          {mastered && <p style={{ color: C.green, fontWeight: 700, fontSize: 14, margin: "2px 0 0" }}>🏅 Mastered{best ? ` · best ${best}%` : ""}</p>}

          <div style={{ ...grownBox, textAlign: "left", marginTop: 14 }}>
            <p style={{ ...grownP, marginBottom: 4 }}>What you'll learn</p>
            <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, margin: 0 }}>{selectedUnit.brief}</p>
          </div>

          <button onClick={() => learnUnit(selectedUnit)} className="pip-cta" style={cta}>
            💬 Learn with {buddyName || "Pip"}
          </button>
          <button onClick={() => startUnitTest(selectedUnit)} className="pip-cta" style={ctaAlt}>
            ✅ {mastered ? "Take the check again" : "Unit Check"}
          </button>
          <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 10 }}>
            Get <b>4 out of 5</b> on the Unit Check to master this unit and unlock the next one. You can practise as much as you like first! 🌟
          </p>
        </div>
      </div>
    );
  }

  // ── Unit result ────────────────────────────────────────────────────
  if (stage === "unitresult" && unitResult && selectedUnit) {
    const r = unitResult;
    const masteredSet = new Set(game.mastered || []);
    const nextUnit = UNITS.find((u) => !masteredSet.has(u.key));
    const fresh = BADGES.filter((b) => newBadges.includes(b.id));
    return (
      <div style={wrap}>
        <Style />
        <div style={{ ...card, maxWidth: 460, textAlign: "center" }}>
          <PipScene level={computeLevel(game.totalSparks).level} size={74} />
          {r.passed ? (
            <>
              <h1 style={h1}>You did it{name ? `, ${name}` : ""}! 🎉</h1>
              <p style={{ ...sub, marginTop: 4 }}>
                You scored <b style={{ color: C.green }}>{r.correct}/{r.total}</b> and
                {r.newlyMastered ? <> mastered <b>{selectedUnit.emoji} {selectedUnit.title}</b>! 🏅</> : <> passed <b>{selectedUnit.title}</b> again! 🏅</>}
              </p>
              {r.newlyMastered && nextUnit && (
                <div className="pip-pop" style={{ ...streakCard, marginTop: 12 }}>
                  🔓 You've unlocked <b>{nextUnit.emoji} {nextUnit.title}</b>!
                </div>
              )}
            </>
          ) : (
            <>
              <h1 style={{ ...h1, fontSize: 26 }}>So close! 💛</h1>
              <p style={{ ...sub, marginTop: 4 }}>
                You got <b>{r.correct}/{r.total}</b>. A little more practice and you'll have it —
                everyone needs a few goes. Let's not rush. 🌱
              </p>
            </>
          )}

          {levelUp && <div className="pip-pop" style={levelUpCard}>🎈 Level up! You're now <b>Level {levelUp.to}</b>!</div>}
          {streakInfo && (
            <div className="pip-pop" style={streakCard}>
              {streakInfo.returning ? <>👋 Welcome back! Fresh <b>🔥 {streakInfo.streak}-day streak</b>.</>
                : streakInfo.streak >= 2 ? <><b>🔥 {streakInfo.streak} days in a row!</b></>
                : <>🔥 Day one of your streak!</>}
            </div>
          )}
          {fresh.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {fresh.map((b) => (
                <div key={b.id} className="pip-pop" style={badgeEarned} title={b.desc}>
                  <div style={{ fontSize: 30 }}>{b.emoji}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
          )}

          {r.passed ? (
            <button onClick={goToPath} className="pip-cta" style={cta}>Back to the path →</button>
          ) : (
            <>
              <button onClick={() => learnUnit(selectedUnit)} className="pip-cta" style={cta}>💬 Practise with {buddyName || "Pip"}</button>
              <button onClick={() => startUnitTest(selectedUnit)} className="pip-cta" style={ctaAlt}>Try the check again</button>
              <button onClick={goToPath} style={grownToggle}>Back to the path</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Warm-up (tappable multiple choice) ─────────────────────────────
  if (stage === "warmup") {
    const q = warmupQs[wIdx];
    const isTest = quizMode === "unittest";
    const quizEmoji = isTest ? (selectedUnit?.emoji || "✅") : "🔥";
    const quizName = isTest ? `${selectedUnit?.title || "Unit"} Check` : "Warm-up";
    return (
      <div style={wrap}>
        <Style />
        <div style={{ ...card, maxWidth: 480 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div className={warmupLoading ? "pip-think" : ""}><Pip size={42} mood={warmupLoading ? "thinking" : speaking ? "talking" : "idle"} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.ink }}>{quizEmoji} {quizName}</div>
              <div style={{ fontSize: 12.5, color: C.inkSoft }}>{isTest ? "Show what you've learned!" : `${topic.emoji} ${topic.label}`}</div>
            </div>
            <button onClick={toggleMute} title={muted ? "Turn voice on" : "Turn voice off"} className="pip-help" style={doneBtn}>{muted ? "🔇" : "🔊"}</button>
            <div style={sparkBox}>
              <span>⭐</span>
              <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.amberDeep }}>{sparks}</span>
            </div>
          </div>

          {warmupLoading || !q ? (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div className="pip-float" style={{ display: "inline-block" }}><Pip size={64} mood="thinking" /></div>
              <p style={{ ...sub, marginTop: 14 }}>{buddyName || "Pip"} is getting your {isTest ? "questions" : "warm-up"} ready…</p>
            </div>
          ) : (
            <>
              {/* progress dots */}
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
                {warmupQs.map((_, i) => (
                  <div key={i} style={{ width: 9, height: 9, borderRadius: 999, background: i < wIdx ? C.green : i === wIdx ? C.amber : "#E7DCC7" }} />
                ))}
              </div>

              <p style={{ fontSize: 12, color: C.inkSoft, fontWeight: 700, textAlign: "center", margin: "0 0 6px" }}>
                Question {wIdx + 1} of {warmupQs.length}
              </p>
              <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, color: C.ink, textAlign: "center", margin: "0 0 18px", lineHeight: 1.3 }}>
                {q.q}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {q.choices.map((c, i) => {
                  const answered = wPick !== null;
                  const isAnswer = i === q.answer;
                  const isPick = i === wPick;
                  let bg = C.white, bd = "#EADFCB", col = C.ink;
                  if (answered && isAnswer) { bg = "#E9FBF5"; bd = C.green; col = C.ink; }
                  else if (answered && isPick && !isAnswer) { bg = "#FFF0F0"; bd = C.coral; col = C.ink; }
                  else if (answered) { col = C.inkSoft; }
                  return (
                    <button key={i} onClick={() => answerWarmup(i)} disabled={answered} className="pip-chip"
                      style={{ ...choiceBtn, background: bg, borderColor: bd, color: col }}>
                      <span>{c}</span>
                      {answered && isAnswer && <span>✅</span>}
                      {answered && isPick && !isAnswer && <span>💛</span>}
                    </button>
                  );
                })}
              </div>

              {wPick !== null && (
                <div className="pip-pop" style={{ ...grownBox, marginTop: 16, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: 14, color: C.ink, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>
                    {wPick === q.answer ? "Yes! Nice one 🌟" : "Good try! 💛"}
                  </p>
                  {q.why && <p style={{ margin: "4px 0 0", fontSize: 13.5, color: C.inkSoft, lineHeight: 1.5 }}>{q.why}</p>}
                </div>
              )}

              <button onClick={nextWarmup} disabled={wPick === null} className="pip-cta"
                style={{ ...cta, opacity: wPick === null ? 0.5 : 1, cursor: wPick === null ? "not-allowed" : "pointer" }}>
                {wIdx + 1 < warmupQs.length ? "Next →" : (quizMode === "unittest" ? "See my result →" : `Start learning with ${buddyName || "Pip"} →`)}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Wrap-up (session end) ──────────────────────────────────────────
  if (stage === "wrapup") {
    const lvl = computeLevel(game.totalSparks).level;
    const fresh = BADGES.filter((b) => newBadges.includes(b.id));
    return (
      <div style={wrap}>
        <Style />
        <div style={{ ...card, maxWidth: 460, textAlign: "center" }}>
          <PipScene level={lvl} size={78} />
          <h1 style={h1}>Great work today{name ? `, ${name}` : ""}! 🎉</h1>
          <p style={{ ...sub, marginTop: 4 }}>
            You earned <b style={{ color: C.amberDeep }}>{sparks} effort spark{sparks === 1 ? "" : "s"}</b> ⭐
            {" "}— every one is a time you tried!
          </p>

          {levelUp && (
            <div className="pip-pop" style={levelUpCard}>
              🎈 Level up! You're now <b>Level {levelUp.to}</b> — {buddyName || "Pip"} has a new friend!
            </div>
          )}

          {streakInfo && (
            <div className="pip-pop" style={streakCard}>
              {streakInfo.returning
                ? <>👋 Welcome back! You've started a fresh <b>🔥 {streakInfo.streak}-day streak</b>.</>
                : streakInfo.streak >= 2
                  ? <><b>🔥 {streakInfo.streak} days in a row!</b> Brilliant turning up.</>
                  : <>🔥 Day one of your streak — see you again soon!</>}
            </div>
          )}

          <div style={{ margin: "16px 0 4px" }}><LevelBar total={game.totalSparks} /></div>

          {fresh.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ ...grownP, marginBottom: 8 }}>New sticker{fresh.length > 1 ? "s" : ""}! 🎁</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {fresh.map((b) => (
                  <div key={b.id} className="pip-pop" style={badgeEarned} title={b.desc}>
                    <div style={{ fontSize: 30 }}>{b.emoji}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, marginTop: 2 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...grownBox, textAlign: "left", marginTop: 18 }}>
            <p style={{ ...grownP, marginBottom: 6 }}>📋 For grown-ups</p>
            {saving ? (
              <p style={{ color: C.inkSoft, fontSize: 13.5, margin: 0 }}>Saving today's progress…</p>
            ) : parentNote ? (
              <p style={{ color: C.ink, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{parentNote}</p>
            ) : (
              <p style={{ color: C.inkSoft, fontSize: 13, margin: 0 }}>
                Session saved. (Add a KV namespace — see the README — to save memory, progress notes and her sticker book.)
              </p>
            )}
          </div>

          <button onClick={newSession} className="pip-cta" style={cta}>Start a new session →</button>
        </div>
      </div>
    );
  }

  // ── Chat ───────────────────────────────────────────────────────────
  return (
    <div style={wrap}>
      <Style />
      <div style={{ ...card, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "min(82vh, 760px)" }}>
        <div style={header}>
          <div className={loading ? "pip-think" : ""}><Pip size={50} mood={loading ? "thinking" : speaking ? "talking" : "idle"} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>
              {buddyName || "Pip"}{name ? ` & ${name}` : ""}
            </div>
            <div style={{ fontSize: 12.5, color: C.inkSoft }}>{topic.emoji} {topic.label}</div>
          </div>
          <div title="Your level" style={{ ...sparkBox, gap: 5 }}>
            <span style={{ fontSize: 14 }}>🌱</span>
            <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.purple, fontSize: 14 }}>Lv {computeLevel(game.totalSparks + sparks).level}</span>
          </div>
          <div title="Effort sparks — one for every time you try!" style={sparkBox}>
            <span style={{ filter: `drop-shadow(0 0 ${Math.min(sparks, 10)}px ${C.amber})` }}>⭐</span>
            <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.amberDeep }}>{sparks}</span>
          </div>
          <button onClick={toggleMute} title={muted ? "Turn voice on" : "Turn voice off"} className="pip-help" style={doneBtn}>{muted ? "🔇" : "🔊"}</button>
          <button onClick={finishSession} disabled={loading} className="pip-help" style={doneBtn}>Done 👋</button>
        </div>

        <div style={topicStrip} className="pip-strip">
          {TOPICS.map((t) => {
            const active = t.key === topic.key;
            return (
              <button key={t.key} onClick={() => switchTopic(t)} className="pip-chip"
                style={{ ...miniChip, background: active ? C.purple : C.white, color: active ? C.white : C.inkSoft, borderColor: active ? C.purple : "#EADFCB" }}>
                <span style={{ marginRight: 4 }}>{t.emoji}</span>{t.label}
              </button>
            );
          })}
        </div>

        <div ref={scrollRef} style={chatArea}>
          {visible.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="pip-msg" style={rowLeft}>
                <div style={{ flexShrink: 0, marginTop: 2 }}><Pip size={30} /></div>
                <div style={bubblePip}>{m.content}</div>
              </div>
            ) : (
              <div key={i} className="pip-msg" style={rowRight}>
                <div style={bubbleKid}>{m.content}</div>
              </div>
            )
          )}
          {loading && (
            <div style={rowLeft}>
              <div style={{ flexShrink: 0, marginTop: 2 }}><Pip size={30} mood="thinking" /></div>
              <div style={{ ...bubblePip, display: "flex", gap: 5, alignItems: "center" }}>
                <span className="pip-dot" /><span className="pip-dot" /><span className="pip-dot" />
              </div>
            </div>
          )}
          {error && (
            <div style={rowLeft}>
              <button onClick={retry} style={errBtn}>{error} Tap to try again ↻</button>
            </div>
          )}
        </div>

        <div style={helperRow}>
          <button onClick={() => { setUsedStuckSession(true); send("I'm a bit stuck. Can you give me a hint?"); }} disabled={loading} className="pip-help" style={{ ...help, color: C.purple, borderColor: C.purpleSoft, background: C.purpleSoft }}>🤔 I'm stuck</button>
          <button onClick={() => send("Can we try an easier one please?")} disabled={loading} className="pip-help" style={{ ...help, color: C.coral, borderColor: "#FFE3E3", background: "#FFF0F0" }}>😣 Too hard</button>
          <button onClick={() => send("That was easy! Can I try a harder one?")} disabled={loading} className="pip-help" style={{ ...help, color: C.green, borderColor: "#D6F5EC", background: "#E9FBF5" }}>⭐ Harder!</button>
        </div>

        <div style={inputRow}>
          {speechSupported && (
            <button onClick={startListening} disabled={loading} title={listening ? "Listening… tap to stop" : "Tap and speak your answer"}
              className={listening ? "pip-listen" : ""}
              style={{ ...micBtn, background: listening ? C.coral : C.white, color: listening ? "#fff" : C.purple, borderColor: listening ? C.coral : "#DCD5FB" }}>
              {listening ? "● Listening" : "🎤"}
            </button>
          )}
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={listening ? "Speak now…" : "Type your answer…"} disabled={loading} style={chatInput} />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="pip-cta"
            style={{ ...sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>
      </div>
    </div>
  );
}

function StickerBook({ game }) {
  const earned = new Set(game.badges || []);
  return (
    <div style={grownBox}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <PipScene level={computeLevel(game.totalSparks).level} size={46} />
        <div style={{ flex: 1 }}><LevelBar total={game.totalSparks} /></div>
        {(game.streak || 0) > 0 && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 22 }}>🔥</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.amberDeep }}>{game.streak} day{game.streak === 1 ? "" : "s"}</div>
          </div>
        )}
      </div>
      <p style={{ ...grownP, marginBottom: 8 }}>My stickers ⭐ ({earned.size}/{BADGES.length})</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {BADGES.map((b) => {
          const have = earned.has(b.id);
          return (
            <div key={b.id} title={b.desc}
              style={{ ...badgeCell, opacity: have ? 1 : 0.45, filter: have ? "none" : "grayscale(1)" }}>
              <div style={{ fontSize: 26 }}>{have ? b.emoji : "🔒"}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.ink, marginTop: 3, lineHeight: 1.2 }}>{b.label}</div>
            </div>
          );
        })}
      </div>
      <p style={{ ...grownP, color: C.inkSoft, fontSize: 11.5, marginTop: 10, marginBottom: 0 }}>
        Stickers and levels are saved when she taps Done 👋 (needs the KV namespace from the README).
      </p>
    </div>
  );
}

function GrownupsNote({ buddyName = "Pip", progress, progressLoading, onLoadProgress }) {
  return (
    <div style={grownBox}>
      <p style={grownP}><b>How to get the most from {buddyName}</b></p>
      <ul style={grownUl}>
        <li>Sit with her for the first few sessions. {buddyName} guides, but your presence keeps her relaxed.</li>
        <li>Keep it short — 10–15 minutes is plenty at age 9. Stop while it's still fun.</li>
        <li>Praise the trying, not just the right answer. The "effort sparks" counter is there for exactly that.</li>
        <li>Tap <b>Done 👋</b> at the end so {buddyName} remembers where she got to next time.</li>
        <li>If a topic keeps causing frustration, that's the gap. Use "Find my starting point" to locate it, then go one level easier.</li>
      </ul>

      <div style={{ borderTop: "1px solid #EFE3CE", margin: "4px 0 12px" }} />
      <p style={{ ...grownP, marginBottom: 8 }}>📈 Progress log</p>
      {progress === null ? (
        <button onClick={onLoadProgress} disabled={progressLoading} className="pip-chip"
          style={{ ...chip, background: C.white, color: C.purple, borderColor: C.purpleSoft }}>
          {progressLoading ? "Loading…" : "View her progress notes"}
        </button>
      ) : progress.length === 0 ? (
        <p style={{ color: C.inkSoft, fontSize: 13, margin: 0 }}>
          No notes yet. They appear after she taps <b>Done 👋</b> at the end of a session.
          (Requires the KV namespace from the README.)
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {progress.map((n, i) => (
            <div key={i} style={{ background: C.white, border: "1px solid #EFE3CE", borderRadius: 12, padding: "9px 12px" }}>
              <div style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 700, marginBottom: 3 }}>{n.date}</div>
              <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{n.note}</div>
            </div>
          ))}
        </div>
      )}

      <p style={{ ...grownP, color: C.inkSoft, fontSize: 12, marginTop: 12 }}>
        {buddyName} is an AI helper, not a replacement for her teacher. For a persistent struggle, a short stint with a human tutor who can watch her face will still beat any app.
      </p>
    </div>
  );
}

// ── styles ───────────────────────────────────────────────────────────
const wrap = { minHeight: "100%", background: `radial-gradient(120% 80% at 50% 0%, ${C.cream2} 0%, ${C.cream} 55%)`, fontFamily: "'Nunito', system-ui, sans-serif", padding: "20px 14px", display: "flex", justifyContent: "center", alignItems: "flex-start", boxSizing: "border-box" };
const card = { width: "100%", maxWidth: 560, background: C.white, borderRadius: 28, padding: 26, boxShadow: "0 18px 50px -22px rgba(45,48,71,0.35), 0 2px 0 #F2E7D4", boxSizing: "border-box" };
const h1 = { fontFamily: "'Baloo 2', sans-serif", fontSize: 30, color: C.ink, textAlign: "center", margin: "8px 0 0" };
const sub = { color: C.inkSoft, textAlign: "center", fontSize: 15, lineHeight: 1.5, margin: "0 auto", maxWidth: 380 };
const fieldLabel = { fontFamily: "'Baloo 2', sans-serif", color: C.ink, fontSize: 15, display: "block", margin: "20px 0 8px" };
const textInput = { width: "100%", boxSizing: "border-box", padding: "13px 16px", fontSize: 16, borderRadius: 14, border: "2px solid #EADFCB", outline: "none", fontFamily: "'Nunito', sans-serif", color: C.ink, background: C.cream };
const chipWrap = { display: "flex", flexWrap: "wrap", gap: 8 };
const chip = { border: "2px solid", borderRadius: 999, padding: "9px 14px", fontSize: 13.5, fontFamily: "'Nunito', sans-serif", fontWeight: 700, cursor: "pointer" };
const cta = { width: "100%", marginTop: 22, padding: "15px", fontSize: 18, fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.white, background: `linear-gradient(180deg, ${C.amber}, ${C.amberDeep})`, border: "none", borderRadius: 16, boxShadow: "0 8px 18px -8px rgba(245,146,34,0.7)" };
const ctaAlt = { width: "100%", marginTop: 10, padding: "13px", fontSize: 16, fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.purple, background: C.purpleSoft, border: "2px solid #DCD5FB", borderRadius: 16 };
const choiceBtn = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "2px solid", borderRadius: 14, padding: "14px 16px", fontSize: 16.5, fontFamily: "'Nunito', sans-serif", fontWeight: 700, cursor: "pointer" };
const grownToggle = { width: "100%", marginTop: 14, padding: "10px", fontSize: 13.5, color: C.inkSoft, background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontWeight: 700 };
const grownBox = { background: C.cream, borderRadius: 16, padding: "14px 16px", marginTop: 4, border: "1px solid #EFE3CE" };
const grownP = { fontFamily: "'Baloo 2', sans-serif", color: C.ink, margin: "0 0 8px", fontSize: 14 };
const grownUl = { margin: "0 0 10px", paddingLeft: 18, color: C.ink, fontSize: 13.5, lineHeight: 1.6 };
const header = { display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", borderBottom: "1px solid #F2E7D4", background: C.cream };
const sparkBox = { display: "flex", alignItems: "center", gap: 4, fontSize: 18, background: C.white, borderRadius: 999, padding: "5px 11px", border: "1px solid #F0E4CF" };
const doneBtn = { border: "1.5px solid #E7DCC7", background: C.white, color: C.inkSoft, borderRadius: 999, padding: "7px 12px", fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 700, cursor: "pointer" };
const levelUpCard = { marginTop: 14, background: `linear-gradient(180deg, #FFF6E6, #FFEFD2)`, border: "1.5px solid #FFD98A", borderRadius: 16, padding: "12px 14px", color: C.ink, fontSize: 14.5, fontFamily: "'Nunito', sans-serif" };
const streakCard = { marginTop: 10, background: "#FFF1E8", border: "1.5px solid #FFD2B3", borderRadius: 16, padding: "11px 14px", color: C.ink, fontSize: 14, fontFamily: "'Nunito', sans-serif" };
const badgeEarned = { background: C.white, border: "1.5px solid #FFE0A6", borderRadius: 16, padding: "12px 10px", width: 96, boxShadow: "0 6px 16px -10px rgba(245,146,34,0.6)" };
const badgeCell = { background: C.white, border: "1px solid #EFE3CE", borderRadius: 14, padding: "10px 6px", textAlign: "center" };
const topicStrip = { display: "flex", gap: 7, padding: "10px 14px", overflowX: "auto", borderBottom: "1px solid #F6EEDF", whiteSpace: "nowrap" };
const miniChip = { border: "1.5px solid", borderRadius: 999, padding: "6px 11px", fontSize: 12, fontFamily: "'Nunito', sans-serif", fontWeight: 700, cursor: "pointer", flexShrink: 0 };
const chatArea = { flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12, background: `linear-gradient(180deg, ${C.white}, ${C.cream})` };
const rowLeft = { display: "flex", gap: 8, alignItems: "flex-start", maxWidth: "92%" };
const rowRight = { display: "flex", justifyContent: "flex-end" };
const bubblePip = { background: C.white, border: "1.5px solid #F1E6D2", color: C.ink, padding: "11px 14px", borderRadius: "16px 16px 16px 5px", fontSize: 15.5, lineHeight: 1.5, whiteSpace: "pre-wrap", boxShadow: "0 4px 14px -10px rgba(45,48,71,0.4)" };
const bubbleKid = { background: `linear-gradient(180deg, ${C.purple}, #5a4bd6)`, color: C.white, padding: "11px 14px", borderRadius: "16px 16px 5px 16px", fontSize: 15.5, lineHeight: 1.5, maxWidth: "80%", whiteSpace: "pre-wrap", boxShadow: "0 6px 16px -10px rgba(108,92,231,0.8)" };
const helperRow = { display: "flex", gap: 7, padding: "10px 12px 4px", flexWrap: "wrap", justifyContent: "center" };
const help = { border: "1.5px solid", borderRadius: 999, padding: "8px 13px", fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 700, cursor: "pointer" };
const inputRow = { display: "flex", gap: 8, padding: "8px 12px 14px" };
const chatInput = { flex: 1, padding: "13px 16px", fontSize: 16, borderRadius: 14, border: "2px solid #EADFCB", outline: "none", fontFamily: "'Nunito', sans-serif", color: C.ink, background: C.cream, minWidth: 0 };
const micBtn = { flexShrink: 0, padding: "0 14px", fontSize: 15, fontFamily: "'Nunito', sans-serif", fontWeight: 700, border: "2px solid", borderRadius: 14, cursor: "pointer", whiteSpace: "nowrap" };
const sendBtn = { padding: "0 20px", fontSize: 16, fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: C.white, background: `linear-gradient(180deg, ${C.amber}, ${C.amberDeep})`, border: "none", borderRadius: 14, cursor: "pointer" };
const errBtn = { background: "#FFF0F0", color: C.coral, border: "1.5px solid #FFD9D9", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontWeight: 700 };

function Style() {
  return (
    <style>{`
      html,body,#root{height:100%}
      .pip-float { animation: pipFloat 3.4s ease-in-out infinite; }
      @keyframes pipFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
      .pip-think { animation: pipNod 1s ease-in-out infinite; }
      @keyframes pipNod { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(4deg)} }
      .pip-msg { animation: pipIn 0.28s ease both; }
      @keyframes pipIn { from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:translateY(0)} }
      .pip-pop { animation: pipPop 0.45s cubic-bezier(.2,1.3,.4,1) both; }
      @keyframes pipPop { from{opacity:0; transform:scale(.6)} to{opacity:1; transform:scale(1)} }
      .pip-mouth { animation: pipTalk .28s ease-in-out infinite; }
      @keyframes pipTalk { 0%,100%{transform:scaleY(.45)} 50%{transform:scaleY(1.1)} }
      .pip-ring { animation: pipRing 1s ease-in-out infinite; }
      @keyframes pipRing { 0%,100%{opacity:.5} 50%{opacity:1} }
      .pip-listen { animation: pipListen .9s ease-in-out infinite; }
      @keyframes pipListen { 0%,100%{box-shadow:0 0 0 0 rgba(255,123,123,.5)} 50%{box-shadow:0 0 0 7px rgba(255,123,123,0)} }
      .pip-dot { width:7px; height:7px; border-radius:50%; background:${C.amber}; display:inline-block; animation: pipBlink 1.2s infinite; }
      .pip-dot:nth-child(2){ animation-delay:.2s } .pip-dot:nth-child(3){ animation-delay:.4s }
      @keyframes pipBlink { 0%,80%,100%{opacity:.3; transform:translateY(0)} 40%{opacity:1; transform:translateY(-3px)} }
      .pip-cta:hover:not(:disabled){ filter:brightness(1.05); transform:translateY(-1px) }
      .pip-cta{ transition:transform .12s, filter .12s }
      .pip-chip:hover{ filter:brightness(0.99); transform:translateY(-1px) } .pip-chip{ transition:transform .12s }
      .pip-help:hover:not(:disabled){ filter:brightness(0.97) }
      .pip-strip::-webkit-scrollbar{ height:0 } .pip-strip{ scrollbar-width:none }
      input::placeholder{ color:#B9B2C9 }
      @media (max-width:480px){ h1{font-size:26px} }
    `}</style>
  );
}
