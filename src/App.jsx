import React, { useState, useRef, useEffect } from "react";

// ── Maths Quest — a booklet game for a 9-year-old ─────────────────────
// Screen-only, tappable. Journey map → 10-question booklets → treasure
// chest prizes, coins, stars and levels. Powered by Claude via /api.

const C = {
  ink: "#2B2350",
  inkSoft: "#6E6790",
  cream: "#FFF8EE",
  white: "#FFFFFF",
  purple: "#7C5CFC",
  purpleSoft: "#EEE9FF",
  pink: "#FF6FB5",
  amber: "#FFB23E",
  amberDeep: "#F59222",
  green: "#22C58B",
  blue: "#3EC5FF",
  coral: "#FF6B6B",
};

const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch {} },
  del(k) { try { window.localStorage.removeItem(k); } catch {} },
};

// ── the journey: 10 themed booklets, in order, getting harder ──────────
const BOOKLETS = [
  { key: "b_place", emoji: "🔢", title: "Number Town", topic: "Place Value", color: C.purple,
    brief: "place value to 1000 — reading, writing, comparing and ordering numbers; hundreds, tens and ones." },
  { key: "b_addsub", emoji: "➕", title: "Plus & Minus Park", topic: "Add & Subtract", color: C.green,
    brief: "addition and subtraction within 1000, including regrouping (carrying and borrowing) and mental strategies." },
  { key: "b_times", emoji: "✖️", title: "Times-Table Towers", topic: "Multiplication", color: C.pink,
    brief: "multiplication as equal groups and arrays; the 2, 3, 4, 5, 6 and 10 times tables; skip-counting." },
  { key: "b_division", emoji: "➗", title: "Sharing Shores", topic: "Division", color: C.blue,
    brief: "division as equal sharing and grouping, and relating division to multiplication." },
  { key: "b_fractions", emoji: "🍕", title: "Fraction Forest", topic: "Fractions", color: C.amber,
    brief: "halves, thirds, quarters and other unit fractions of shapes and groups; comparing simple fractions." },
  { key: "b_measure", emoji: "📏", title: "Measure Mountain", topic: "Measurement", color: C.coral,
    brief: "measuring and comparing length (cm, m), mass (g, kg) and volume (ml, l); reading simple scales." },
  { key: "b_money", emoji: "💰", title: "Money Market", topic: "Money", color: C.green,
    brief: "recognising coins and notes, making and adding amounts, and giving change." },
  { key: "b_time", emoji: "🕒", title: "Clock Castle", topic: "Telling Time", color: C.purple,
    brief: "reading clocks to the hour, half past, quarter past/to and five minutes; am/pm; simple durations." },
  { key: "b_shapes", emoji: "🔺", title: "Shape Space", topic: "Shapes", color: C.blue,
    brief: "naming 2D and 3D shapes and their properties (sides, corners, faces, edges); right angles; symmetry." },
  { key: "b_word", emoji: "🧩", title: "Puzzle Peak", topic: "Word Problems", color: C.pink,
    brief: "one- and two-step word problems using everything learned; choosing the right operation." },
];

const QS_PER_BOOKLET = 10;
const COINS_PER_CORRECT = 5;

function computeLevel(total) {
  let level = 1, need = 8, acc = 0;
  while (total >= acc + need) { acc += need; level += 1; need += 3; }
  return { level, into: total - acc, need, pct: Math.round(((total - acc) / need) * 100) };
}

const DEFAULT_GAME = { totalSparks: 0, coins: 0, sessions: 0, stars: {}, mastered: [], badges: [], streak: 0, lastDate: "" };

const BADGES = [
  { id: "first_book", emoji: "🎒", label: "First Booklet", desc: "Finished your first booklet", test: (s) => s.sessions >= 1 },
  { id: "perfect", emoji: "💯", label: "Perfect!", desc: "Got 3 stars on a booklet", test: (s) => s.hasPerfect },
  { id: "stars10", emoji: "⭐", label: "Star Catcher", desc: "Collected 10 stars", test: (s) => s.totalStars >= 10 },
  { id: "coins100", emoji: "🪙", label: "Coin Collector", desc: "Earned 100 coins", test: (s) => s.coins >= 100 },
  { id: "streak3", emoji: "🔥", label: "On a Roll", desc: "Played 3 days in a row", test: (s) => (s.streak || 0) >= 3 },
  { id: "streak7", emoji: "⚡", label: "Super Streak", desc: "Played 7 days in a row", test: (s) => (s.streak || 0) >= 7 },
  { id: "half", emoji: "🥈", label: "Halfway Hero", desc: "Cleared 5 booklets", test: (s) => (s.mastered || []).length >= 5 },
  { id: "champion", emoji: "👑", label: "Maths Champion", desc: "Cleared every booklet", test: (s) => (s.mastered || []).length >= BOOKLETS.length },
];

function statsFrom(g) {
  const starVals = Object.values(g.stars || {});
  return {
    sessions: g.sessions || 0,
    coins: g.coins || 0,
    totalStars: starVals.reduce((a, b) => a + (b || 0), 0),
    hasPerfect: starVals.some((v) => v >= 3),
    mastered: g.mastered || [],
    streak: g.streak || 0,
    totalSparks: g.totalSparks || 0,
  };
}
function earnedBadges(g) {
  const s = statsFrom(g);
  return BADGES.filter((b) => b.test(s)).map((b) => b.id);
}

function localDate(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function isYesterday(prev, today) {
  if (!prev) return false;
  return new Date(today + "T00:00:00") - new Date(prev + "T00:00:00") === 86400000;
}
function computeDailyUpdate(g) {
  const today = localDate();
  let streak;
  if (g.lastDate === today) streak = g.streak || 1;
  else if (isYesterday(g.lastDate, today)) streak = (g.streak || 0) + 1;
  else streak = 1;
  return { today, streak };
}

function stripForSpeech(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2705}\u{2B50}]/gu, "")
    .replace(/×/g, " times ").replace(/÷/g, " divided by ")
    .replace(/=/g, " equals ").replace(/\+/g, " plus ")
    .replace(/\s+/g, " ").trim();
}

const starsFromPct = (pct) => (pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0);

// ── friendly female teacher mascot ────────────────────────────────────
const SKIN = "#E8B48F", HAIR = "#46342A";
function Pip({ mood = "idle", size = 64 }) {
  const thinking = mood === "thinking", talking = mood === "talking";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
      <circle cx="50" cy="50" r="48" fill="#FFF3E0" />
      <circle cx="50" cy="50" r="47" fill="none" stroke={talking ? "#FFCD79" : "#F4E6CC"} strokeWidth="2" className={talking ? "g-ring" : ""} />
      <clipPath id="pc"><circle cx="50" cy="50" r="46" /></clipPath>
      <g clipPath="url(#pc)">
        <path d="M18 100 C20 78 34 70 50 70 C66 70 80 78 82 100 Z" fill={C.purple} />
        <path d="M50 70 L44 84 L50 92 L56 84 Z" fill="#fff" opacity="0.95" />
        <rect x="44" y="60" width="12" height="14" rx="5" fill="#D89E76" />
        <path d="M24 44 C20 60 22 78 26 92 L34 92 C30 78 30 60 32 50 C30 47 28 46 26 46 Z" fill={HAIR} />
        <path d="M76 44 C80 60 78 78 74 92 L66 92 C70 78 70 60 68 50 C70 47 72 46 74 46 Z" fill={HAIR} />
        <ellipse cx="50" cy="45" rx="20" ry="22" fill={SKIN} />
        <circle cx="30" cy="46" r="4" fill={SKIN} /><circle cx="70" cy="46" r="4" fill={SKIN} />
        <path d="M27 46 C24 22 44 16 50 16 C56 16 76 22 73 46 C73 35 64 29 50 29 C36 29 27 35 27 46 Z" fill={HAIR} />
        <path d="M27 47 C26 38 30 31 35 28 C31 34 32 41 32 47 Z" fill={HAIR} />
        <path d="M73 47 C74 38 70 31 65 28 C69 34 68 41 68 47 Z" fill={HAIR} />
        <circle cx="64" cy="30" r="2.4" fill={C.pink} />
        <circle cx="37" cy="50" r="4" fill="#FF9F6E" opacity="0.4" /><circle cx="63" cy="50" r="4" fill="#FF9F6E" opacity="0.4" />
        <path d={thinking ? "M37 35 q5 -3 9 -1" : "M37 36 q5 -2 9 0"} stroke={HAIR} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d={thinking ? "M54 34 q5 -2 9 1" : "M54 36 q5 -2 9 0"} stroke={HAIR} strokeWidth="2" fill="none" strokeLinecap="round" />
        <g stroke={C.ink} strokeWidth="1.6" fill="none" opacity="0.85">
          <rect x="34" y="40" width="13" height="10" rx="5" /><rect x="53" y="40" width="13" height="10" rx="5" /><line x1="47" y1="44" x2="53" y2="44" />
        </g>
        {thinking ? (
          <><path d="M38 44 q3 -3 6 0" stroke={C.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" /><path d="M56 44 q3 -3 6 0" stroke={C.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" /></>
        ) : (
          <><circle cx="41" cy="45" r="2.4" fill={C.ink} /><circle cx="59" cy="45" r="2.4" fill={C.ink} /></>
        )}
        {talking ? <ellipse cx="50" cy="57" rx="5" ry="3.6" fill="#7A3B3B" className="g-mouth" style={{ transformOrigin: "50px 57px" }} />
          : thinking ? <circle cx="50" cy="57" r="2.4" fill="#7A3B3B" />
            : <path d="M43 56 q7 7 14 0" stroke="#7A3B3B" strokeWidth="2.6" fill="none" strokeLinecap="round" />}
      </g>
    </svg>
  );
}

function Chest({ open }) {
  return (
    <svg viewBox="0 0 120 110" width="170" height="156" style={{ display: "block", margin: "0 auto" }}>
      {open && [...Array(7)].map((_, i) => (
        <text key={i} x={20 + i * 13} y={20 + (i % 3) * 8} fontSize="13" className="g-spark" style={{ animationDelay: `${i * 0.08}s` }}>✨</text>
      ))}
      {/* base */}
      <rect x="20" y="55" width="80" height="45" rx="8" fill="#9B5A2B" />
      <rect x="20" y="55" width="80" height="45" rx="8" fill="none" stroke="#7A431D" strokeWidth="3" />
      <rect x="52" y="68" width="16" height="20" rx="3" fill="#FFD66B" />
      <circle cx="60" cy="74" r="3" fill="#7A431D" />
      {/* glow when open */}
      {open && <ellipse cx="60" cy="56" rx="42" ry="14" fill="#FFE08A" opacity="0.7" className="g-glow" />}
      {/* lid */}
      <g style={{ transformOrigin: "60px 55px", transform: open ? "rotate(-22deg) translateY(-4px)" : "none", transition: "transform .5s cubic-bezier(.2,1.4,.4,1)" }}>
        <path d="M20 55 Q20 32 60 32 Q100 32 100 55 Z" fill="#A9612F" />
        <path d="M20 55 Q20 32 60 32 Q100 32 100 55 Z" fill="none" stroke="#7A431D" strokeWidth="3" />
        <rect x="18" y="50" width="84" height="9" rx="4" fill="#FFD66B" />
      </g>
    </svg>
  );
}

function Confetti() {
  const cols = [C.purple, C.pink, C.amber, C.green, C.blue, C.coral];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {[...Array(16)].map((_, i) => (
        <div key={i} className="g-confetti" style={{
          left: `${(i * 6.3) % 100}%`, background: cols[i % cols.length],
          animationDelay: `${(i % 8) * 0.12}s`, transform: `rotate(${i * 33}deg)`,
        }} />
      ))}
    </div>
  );
}

function Stars({ n, size = 26, animate }) {
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={animate && i <= n ? "g-pop" : ""} style={{ fontSize: size, filter: i <= n ? "none" : "grayscale(1)", opacity: i <= n ? 1 : 0.35, animationDelay: `${i * 0.15}s` }}>⭐</span>
      ))}
    </div>
  );
}

export default function MathsGame() {
  const [stage, setStage] = useState("gate"); // gate | welcome | home | play | reward
  const [passcode, setPasscode] = useState("");
  const [pcInput, setPcInput] = useState("");
  const [gateError, setGateError] = useState("");
  const [name, setName] = useState("");
  const [buddyName, setBuddyName] = useState("Pip");
  const [game, setGame] = useState(DEFAULT_GAME);

  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [booklet, setBooklet] = useState(null);
  const [qs, setQs] = useState([]);
  const [qLoading, setQLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [reward, setReward] = useState(null); // {stars, pct, passed, coins, newlyMastered, newBadges, levelUp, streak}
  const [chestOpen, setChestOpen] = useState(false);
  const [showBook, setShowBook] = useState(false);

  // ── voice ──
  useEffect(() => {
    const id = "g-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap";
      document.head.appendChild(l);
    }
    const pc = store.get("pip_pc"), nm = store.get("pip_name"), bd = store.get("pip_buddy");
    if (nm) setName(nm);
    if (bd) setBuddyName(bd);
    if (store.get("pip_muted") === "1") setMuted(true);
    if (pc) { setPasscode(pc); setStage(nm ? "home" : "welcome"); if (nm) loadGame(nm, pc); }
    try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch {}
    // eslint-disable-next-line
  }, []);

  function pickVoice() {
    try {
      const vs = window.speechSynthesis.getVoices() || [];
      const en = vs.filter((v) => /^en/i.test(v.lang));
      const pref = [/Google UK English Female/i, /Microsoft (Aria|Jenny|Sonia|Libby)[^]*Natural/i, /Samantha/i, /Serena/i, /Karen/i, /Moira/i, /Tessa/i, /Google US English/i, /female/i];
      for (const re of pref) { const m = en.find((v) => re.test(v.name)); if (m) return m; }
      return en.find((v) => !/(male|daniel|fred|alex|arthur|oliver|george|guy|david)/i.test(v.name)) || en[0] || vs[0] || null;
    } catch { return null; }
  }
  function speak(text) {
    if (muted) return;
    const clean = stripForSpeech(text);
    if (!clean) return;
    try {
      const synth = window.speechSynthesis; if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      const v = pickVoice(); if (v) u.voice = v;
      u.rate = 0.94; u.pitch = 1.12;
      u.onstart = () => setSpeaking(true); u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
      synth.speak(u);
    } catch {}
  }
  function stopSpeak() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {} setSpeaking(false); }
  function toggleMute() { setMuted((m) => { const n = !m; store.set("pip_muted", n ? "1" : "0"); if (n) stopSpeak(); return n; }); }

  // read each question aloud
  useEffect(() => {
    if (stage === "play" && !qLoading && qs[idx] && pick === null) speak(qs[idx].q);
    // eslint-disable-next-line
  }, [stage, idx, qs, qLoading]);

  // ── game state ──
  async function loadGame(forName, pc) {
    try {
      const res = await fetch("/api/game", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: pc ?? passcode, name: forName ?? name, action: "load" }),
      });
      const data = res.ok ? await res.json() : null;
      setGame(data && data.state ? { ...DEFAULT_GAME, ...data.state } : DEFAULT_GAME);
    } catch { setGame(DEFAULT_GAME); }
  }
  function saveGame(updated) {
    fetch("/api/game", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, name, action: "save", state: updated }),
    }).catch(() => {});
  }

  // ── navigation / flow ──
  function submitGate() {
    const v = pcInput.trim(); if (!v) return;
    setPasscode(v); store.set("pip_pc", v); setGateError("");
    setStage(name ? "home" : "welcome");
    if (name) loadGame(name, v);
  }
  function finishWelcome() {
    if (!name.trim()) return;
    store.set("pip_name", name.trim());
    store.set("pip_buddy", (buddyName || "Pip").trim());
    loadGame(name);
    setStage("home");
  }

  const masteredSet = new Set(game.mastered || []);
  const currentIdx = BOOKLETS.findIndex((b) => !masteredSet.has(b.key));

  async function playBooklet(b) {
    setBooklet(b);
    setQs([]); setIdx(0); setPick(null); setCorrectCount(0); setCoinsEarned(0); setShowHint(false);
    setQLoading(true); setStage("play");
    try {
      const res = await fetch("/api/warmup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, name, topicLabel: b.topic, topicBrief: b.brief, mode: "test", count: QS_PER_BOOKLET }),
      });
      const data = res.ok ? await res.json() : { questions: [] };
      if (!data.questions || !data.questions.length) { setStage("home"); return; }
      setQs(data.questions);
    } catch { setStage("home"); } finally { setQLoading(false); }
  }

  function answer(i) {
    if (pick !== null) return;
    const q = qs[idx];
    const right = i === q.answer;
    setPick(i);
    if (right) { setCorrectCount((c) => c + 1); setCoinsEarned((c) => c + COINS_PER_CORRECT); }
    speak((right ? "Yes! " : "Good try. ") + (q.why || ""));
  }
  function next() {
    if (idx + 1 < qs.length) { setIdx((i) => i + 1); setPick(null); setShowHint(false); }
    else finishBooklet();
  }

  function finishBooklet() {
    stopSpeak();
    const total = qs.length;
    const pct = total ? Math.round((correctCount / total) * 100) : 0;
    const stars = starsFromPct(pct);
    const passed = stars >= 2;
    const sparks = total + correctCount; // try + correct
    const { today, streak } = computeDailyUpdate(game);
    const prevStars = (game.stars || {})[booklet.key] || 0;
    const newStars = { ...(game.stars || {}), [booklet.key]: Math.max(prevStars, stars) };
    const mastered = new Set(game.mastered || []);
    const newlyMastered = passed && !mastered.has(booklet.key);
    if (passed) mastered.add(booklet.key);
    const updated = {
      ...game,
      totalSparks: (game.totalSparks || 0) + sparks,
      coins: (game.coins || 0) + coinsEarned,
      sessions: (game.sessions || 0) + 1,
      stars: newStars,
      mastered: Array.from(mastered),
      streak, lastDate: today,
    };
    const before = computeLevel(game.totalSparks || 0).level;
    const after = computeLevel(updated.totalSparks).level;
    const prevBadges = game.badges || [];
    const now = earnedBadges(updated);
    updated.badges = now;

    setGame(updated);
    saveGame(updated);
    setReward({
      stars, pct, passed, coins: coinsEarned, newlyMastered,
      newBadges: BADGES.filter((b) => now.includes(b.id) && !prevBadges.includes(b.id)),
      levelUp: after > before ? after : null, streak,
    });
    setChestOpen(false);
    setStage("reward");
  }

  function backToMap() {
    stopSpeak();
    setReward(null); setChestOpen(false); setBooklet(null);
    setStage("home");
  }

  // ════════════════════════ SCREENS ════════════════════════

  if (stage === "gate") {
    return (
      <Shell>
        <div style={{ ...card, maxWidth: 400, textAlign: "center" }}>
          <div className="g-float" style={{ marginBottom: 4 }}><Pip size={88} /></div>
          <h1 style={h1}>Maths Quest</h1>
          <p style={sub}>Pop in the secret word to play! 🔑</p>
          <input value={pcInput} onChange={(e) => setPcInput(e.target.value)} type="password"
            onKeyDown={(e) => e.key === "Enter" && submitGate()} placeholder="Secret word…" style={input} />
          {gateError && <p style={{ color: C.coral, fontWeight: 700, fontSize: 13.5, marginTop: 10 }}>{gateError}</p>}
          <button onClick={submitGate} disabled={!pcInput.trim()} className="g-btn" style={{ ...cta, opacity: pcInput.trim() ? 1 : 0.5 }}>Let me in →</button>
        </div>
      </Shell>
    );
  }

  if (stage === "welcome") {
    return (
      <Shell>
        <div style={{ ...card, maxWidth: 420, textAlign: "center" }}>
          <div className="g-float"><Pip size={92} /></div>
          <h1 style={h1}>Welcome to Maths Quest!</h1>
          <p style={sub}>Answer booklets, win treasure, and level up. 🏆</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name…" maxLength={20}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && finishWelcome()} style={{ ...input, marginTop: 16 }} />
          <input value={buddyName} onChange={(e) => setBuddyName(e.target.value)} placeholder="Name your helper (e.g. Pip)" maxLength={16} style={{ ...input, marginTop: 10 }} />
          <button onClick={finishWelcome} disabled={!name.trim()} className="g-btn" style={{ ...cta, opacity: name.trim() ? 1 : 0.5 }}>Start the quest! →</button>
        </div>
      </Shell>
    );
  }

  // ── HOME / journey map ──
  if (stage === "home") {
    const lv = computeLevel(game.totalSparks || 0);
    return (
      <Shell>
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {/* HUD */}
          <div style={hud}>
            <div className="g-float2"><Pip size={44} mood={speaking ? "talking" : "idle"} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.head, fontWeight: 800, color: C.ink, fontSize: 16 }}>Hi {name}! 👋</div>
              <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                <Pill>🪙 {game.coins || 0}</Pill>
                <Pill>⭐ Lv {lv.level}</Pill>
                {(game.streak || 0) > 0 && <Pill>🔥 {game.streak}</Pill>}
              </div>
            </div>
            <button onClick={toggleMute} className="g-btn" style={iconBtn}>{muted ? "🔇" : "🔊"}</button>
          </div>
          <div style={{ padding: "6px 16px 0" }}><LevelBar total={game.totalSparks || 0} /></div>

          {/* journey */}
          <div style={{ position: "relative", padding: "18px 0 8px" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 4, marginLeft: -2, background: "repeating-linear-gradient(#E7DEF6 0 10px, transparent 10px 20px)" }} />
            {BOOKLETS.map((b, i) => {
              const done = masteredSet.has(b.key);
              const current = !done && currentIdx === i;
              const locked = !done && !current;
              const st = (game.stars || {})[b.key] || 0;
              const side = i % 2 === 0 ? "flex-start" : "flex-end";
              return (
                <div key={b.key} style={{ position: "relative", display: "flex", justifyContent: side, padding: "10px 26px" }}>
                  <button onClick={() => !locked && playBooklet(b)} disabled={locked} className={current ? "g-pulse g-btn" : "g-btn"}
                    style={{
                      width: 150, textAlign: "center", borderRadius: 22, padding: "12px 8px 10px", cursor: locked ? "default" : "pointer",
                      background: locked ? "#EFEAF7" : "#fff", border: `3px solid ${locked ? "#E0D7F0" : b.color}`,
                      opacity: locked ? 0.65 : 1, boxShadow: locked ? "none" : `0 8px 0 -2px ${b.color}33`,
                    }}>
                    <div style={{ width: 56, height: 56, margin: "0 auto", borderRadius: 999, background: locked ? "#DAD0EC" : b.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "inset 0 -3px 0 rgba(0,0,0,.12)" }}>
                      {locked ? "🔒" : b.emoji}
                    </div>
                    <div style={{ fontFamily: F.head, fontWeight: 800, color: C.ink, fontSize: 14, marginTop: 6 }}>{b.title}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>{b.topic}</div>
                    {done ? <div style={{ marginTop: 4 }}><Stars n={st} size={15} /></div>
                      : current ? <div style={{ marginTop: 5, fontSize: 12, fontWeight: 800, color: b.color }}>PLAY ▶</div>
                        : <div style={{ marginTop: 5, fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>locked</div>}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ padding: "4px 16px 16px", display: "flex", gap: 8 }}>
            <button onClick={() => { loadGame(name); setShowBook(true); }} className="g-btn" style={{ ...softBtn, flex: 1 }}>🏆 My prizes</button>
          </div>
          {masteredSet.size === BOOKLETS.length && (
            <div className="g-pop" style={{ ...banner, margin: "0 16px 16px" }}>👑 You cleared every booklet — Maths Champion!</div>
          )}
        </div>

        {showBook && <PrizeBook game={game} onClose={() => setShowBook(false)} />}
      </Shell>
    );
  }

  // ── PLAY ──
  if (stage === "play") {
    const q = qs[idx];
    return (
      <Shell>
        <div style={{ ...card, maxWidth: 500 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <button onClick={backToMap} className="g-btn" style={iconBtn}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.head, fontWeight: 800, color: C.ink, fontSize: 15 }}>{booklet.emoji} {booklet.title}</div>
            </div>
            <Pill>🪙 {coinsEarned}</Pill>
            <button onClick={toggleMute} className="g-btn" style={iconBtn}>{muted ? "🔇" : "🔊"}</button>
          </div>

          {qLoading || !q ? (
            <div style={{ textAlign: "center", padding: "44px 0" }}>
              <div className="g-float" style={{ display: "inline-block" }}><Pip size={70} mood="thinking" /></div>
              <p style={{ ...sub, marginTop: 14 }}>Opening your booklet… 📖</p>
            </div>
          ) : (
            <>
              {/* progress */}
              <div style={{ height: 12, borderRadius: 999, background: "#EFEAF7", overflow: "hidden", marginBottom: 4 }}>
                <div style={{ width: `${(idx / qs.length) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${booklet.color}, ${C.amber})`, borderRadius: 999, transition: "width .3s" }} />
              </div>
              <p style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: C.inkSoft, margin: "0 0 14px" }}>Question {idx + 1} of {qs.length}</p>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ flexShrink: 0 }}><Pip size={40} mood={speaking ? "talking" : "idle"} /></div>
                <h2 style={{ fontFamily: F.head, fontSize: 21, color: C.ink, margin: 0, lineHeight: 1.3 }}>{q.q}</h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {q.choices.map((c, i) => {
                  const answered = pick !== null, isAns = i === q.answer, isPick = i === pick;
                  let bg = "#fff", bd = "#E4DAF5", col = C.ink;
                  if (answered && isAns) { bg = "#E6FAF2"; bd = C.green; }
                  else if (answered && isPick) { bg = "#FFEFEF"; bd = C.coral; }
                  else if (answered) { col = C.inkSoft; }
                  return (
                    <button key={i} onClick={() => answer(i)} disabled={answered} className="g-btn" style={{ ...choice, background: bg, borderColor: bd, color: col }}>
                      <span>{c}</span>
                      {answered && isAns && <span>✅</span>}
                      {answered && isPick && !isAns && <span>💛</span>}
                    </button>
                  );
                })}
              </div>

              {pick === null && q.why && (
                showHint
                  ? <div style={{ ...hintBox }}>💡 {q.why}</div>
                  : <button onClick={() => setShowHint(true)} className="g-btn" style={{ ...softBtn, marginTop: 12 }}>💡 Hint</button>
              )}

              {pick !== null && (
                <>
                  <div className="g-pop" style={{ ...feedback, borderColor: pick === q.answer ? C.green : C.amber }}>
                    <b>{pick === q.answer ? "Correct! +5 🪙" : "Good try! 💛"}</b>{q.why ? ` ${q.why}` : ""}
                  </div>
                  <button onClick={next} className="g-btn" style={cta}>{idx + 1 < qs.length ? "Next →" : "Open my treasure! 🎁"}</button>
                </>
              )}
            </>
          )}
        </div>
      </Shell>
    );
  }

  // ── REWARD / treasure ──
  if (stage === "reward" && reward) {
    return (
      <Shell>
        <div style={{ ...card, maxWidth: 440, textAlign: "center", position: "relative" }}>
          {chestOpen && reward.passed && <Confetti />}
          <h1 style={{ ...h1, fontSize: 26 }}>{booklet.title} {reward.passed ? "cleared!" : "— good try!"}</h1>
          <p style={{ ...sub, marginTop: 2 }}>You got {reward.pct}% right</p>

          <div onClick={() => setChestOpen(true)} style={{ cursor: chestOpen ? "default" : "pointer", margin: "6px 0" }} className={chestOpen ? "" : "g-float"}>
            <Chest open={chestOpen} />
          </div>

          {!chestOpen ? (
            <button onClick={() => setChestOpen(true)} className="g-btn" style={cta}>Tap to open! 🎁</button>
          ) : (
            <div className="g-pop">
              <Stars n={reward.stars} size={32} animate />
              <div style={{ display: "flex", justifyContent: "center", gap: 14, margin: "14px 0" }}>
                <div style={prizePill}>🪙 +{reward.coins}</div>
                <div style={prizePill}>⭐ +{reward.stars} stars</div>
              </div>

              {reward.newlyMastered && <div className="g-pop" style={banner}>🏅 New medal — booklet cleared!</div>}
              {reward.levelUp && <div className="g-pop" style={{ ...banner, background: "#FFF3D9", borderColor: "#FFD98A" }}>🎈 Level up! You're now Level {reward.levelUp}!</div>}
              {reward.streak >= 2 && <div style={{ ...banner, background: "#FFF1E8", borderColor: "#FFD2B3" }}>🔥 {reward.streak}-day streak!</div>}

              {reward.newBadges.length > 0 && (
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                  {reward.newBadges.map((b) => (
                    <div key={b.id} className="g-pop" style={badgeCard} title={b.desc}>
                      <div style={{ fontSize: 28 }}>{b.emoji}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.ink }}>{b.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={backToMap} className="g-btn" style={cta}>Back to the map →</button>
              {!reward.passed && <button onClick={() => playBooklet(booklet)} className="g-btn" style={softBtn}>Try this booklet again</button>}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  return <Shell><div style={card}>Loading…</div></Shell>;
}

// ── small components ──
function Shell({ children }) {
  return (
    <div style={shell}><Style />{children}</div>
  );
}
function Pill({ children }) {
  return <span style={{ background: "#fff", border: "1.5px solid #ECE3FB", borderRadius: 999, padding: "3px 9px", fontSize: 12.5, fontWeight: 800, color: C.ink }}>{children}</span>;
}
function LevelBar({ total }) {
  const { level, need, into } = computeLevel(total);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, color: C.inkSoft, marginBottom: 3 }}>
        <span>Level {level}</span><span>{need - into} ⭐ to next</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "#EFEAF7", overflow: "hidden" }}>
        <div style={{ width: `${Math.round((into / need) * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${C.amber}, ${C.amberDeep})`, borderRadius: 999, transition: "width .5s" }} />
      </div>
    </div>
  );
}
function PrizeBook({ game, onClose }) {
  const earned = new Set(game.badges || []);
  const totalStars = Object.values(game.stars || {}).reduce((a, b) => a + (b || 0), 0);
  return (
    <div style={modalWrap} onClick={onClose}>
      <div style={{ ...card, maxWidth: 440, maxHeight: "84vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ fontFamily: F.head, fontSize: 20, color: C.ink, margin: 0, flex: 1 }}>🏆 My Prizes</h2>
          <button onClick={onClose} className="g-btn" style={iconBtn}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={statCard}>🪙<br /><b>{game.coins || 0}</b><br /><span style={statLbl}>coins</span></div>
          <div style={statCard}>⭐<br /><b>{totalStars}</b><br /><span style={statLbl}>stars</span></div>
          <div style={statCard}>🏅<br /><b>{(game.mastered || []).length}/{BOOKLETS.length}</b><br /><span style={statLbl}>cleared</span></div>
        </div>
        <p style={{ fontFamily: F.head, fontWeight: 800, color: C.ink, margin: "0 0 8px" }}>Stickers ({earned.size}/{BADGES.length})</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {BADGES.map((b) => {
            const has = earned.has(b.id);
            return (
              <div key={b.id} title={b.desc} style={{ background: "#fff", border: "1.5px solid #ECE3FB", borderRadius: 14, padding: "10px 6px", textAlign: "center", opacity: has ? 1 : 0.45, filter: has ? "none" : "grayscale(1)" }}>
                <div style={{ fontSize: 26 }}>{has ? b.emoji : "🔒"}</div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: C.ink, marginTop: 2 }}>{b.label}</div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 12, textAlign: "center" }}>Prizes save when she finishes a booklet (needs the KV store from the README).</p>
      </div>
    </div>
  );
}

// ── styles ──
const F = { head: "'Baloo 2', system-ui, sans-serif", body: "'Nunito', system-ui, sans-serif" };
const shell = { minHeight: "100%", background: `radial-gradient(130% 90% at 50% -10%, #FFE7F4 0%, #EAF4FF 45%, #FFF8EE 100%)`, fontFamily: F.body, padding: "18px 12px", display: "flex", justifyContent: "center", alignItems: "flex-start", boxSizing: "border-box" };
const card = { width: "100%", maxWidth: 560, background: "rgba(255,255,255,0.96)", borderRadius: 28, padding: 22, boxShadow: "0 20px 50px -22px rgba(80,50,140,0.4)", boxSizing: "border-box" };
const h1 = { fontFamily: F.head, fontSize: 30, color: C.ink, margin: "8px 0 0", textAlign: "center" };
const sub = { color: C.inkSoft, fontSize: 15, textAlign: "center", margin: "4px auto 0", maxWidth: 360, lineHeight: 1.5, fontWeight: 600 };
const input = { width: "100%", boxSizing: "border-box", padding: "14px 16px", fontSize: 16, borderRadius: 16, border: "2px solid #E4DAF5", outline: "none", fontFamily: F.body, color: C.ink, background: C.cream };
const cta = { width: "100%", marginTop: 16, padding: "15px", fontSize: 18, fontFamily: F.head, fontWeight: 800, color: "#fff", background: `linear-gradient(180deg, ${C.purple}, #6a48f0)`, border: "none", borderRadius: 18, boxShadow: `0 7px 0 -1px #5a3ad6`, cursor: "pointer" };
const softBtn = { width: "100%", marginTop: 10, padding: "12px", fontSize: 15, fontFamily: F.head, fontWeight: 800, color: C.purple, background: C.purpleSoft, border: "2px solid #DCD0FB", borderRadius: 16, cursor: "pointer" };
const iconBtn = { width: 40, height: 40, flexShrink: 0, fontSize: 16, background: "#fff", border: "1.5px solid #ECE3FB", borderRadius: 12, cursor: "pointer", fontWeight: 800, color: C.ink };
const hud = { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 8px" };
const choice = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "2.5px solid", borderRadius: 16, padding: "15px 16px", fontSize: 17, fontFamily: F.body, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 0 -1px rgba(0,0,0,0.05)" };
const feedback = { marginTop: 14, background: "#FFFDF6", border: "2px solid", borderRadius: 16, padding: "12px 14px", fontSize: 14.5, color: C.ink, lineHeight: 1.5, fontWeight: 600 };
const hintBox = { marginTop: 12, background: "#FFF7E6", border: "2px solid #FFE0A6", borderRadius: 14, padding: "11px 14px", fontSize: 14, color: C.ink, fontWeight: 700 };
const banner = { marginTop: 12, background: "#EEF8F1", border: "2px solid #BFE9D2", borderRadius: 16, padding: "11px 14px", fontSize: 14.5, color: C.ink, fontWeight: 700 };
const prizePill = { background: "#fff", border: "2px solid #ECE3FB", borderRadius: 14, padding: "10px 16px", fontFamily: F.head, fontWeight: 800, color: C.ink, fontSize: 18 };
const badgeCard = { background: "#fff", border: "2px solid #FFE0A6", borderRadius: 14, padding: "10px 8px", width: 92 };
const modalWrap = { position: "fixed", inset: 0, background: "rgba(43,35,80,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const statCard = { flex: 1, background: C.cream, border: "1.5px solid #ECE3FB", borderRadius: 14, padding: "10px 4px", textAlign: "center", fontSize: 20, fontFamily: F.head, color: C.ink, lineHeight: 1.4 };
const statLbl = { fontSize: 10.5, color: C.inkSoft, fontWeight: 700 };

function Style() {
  return (
    <style>{`
      html,body,#root{height:100%}
      *{ -webkit-tap-highlight-color: transparent; }
      .g-btn{ transition: transform .1s; }
      .g-btn:active:not(:disabled){ transform: translateY(2px); }
      .g-float{ animation: gFloat 3.2s ease-in-out infinite; }
      .g-float2{ animation: gFloat 4s ease-in-out infinite; }
      @keyframes gFloat{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
      .g-pulse{ animation: gPulse 1.5s ease-in-out infinite; }
      @keyframes gPulse{ 0%,100%{box-shadow:0 0 0 0 rgba(124,92,252,.4)} 50%{box-shadow:0 0 0 10px rgba(124,92,252,0)} }
      .g-pop{ animation: gPop .45s cubic-bezier(.2,1.4,.4,1) both; }
      @keyframes gPop{ from{opacity:0; transform:scale(.6)} to{opacity:1; transform:scale(1)} }
      .g-mouth{ animation: gTalk .28s ease-in-out infinite; }
      @keyframes gTalk{ 0%,100%{transform:scaleY(.45)} 50%{transform:scaleY(1.1)} }
      .g-ring{ animation: gRing 1s ease-in-out infinite; }
      @keyframes gRing{ 0%,100%{opacity:.5} 50%{opacity:1} }
      .g-spark{ animation: gSpark 1.2s ease-in-out infinite; }
      @keyframes gSpark{ 0%,100%{opacity:.2} 50%{opacity:1} }
      .g-glow{ animation: gGlow 1.6s ease-in-out infinite; }
      @keyframes gGlow{ 0%,100%{opacity:.4} 50%{opacity:.85} }
      .g-confetti{ position:absolute; top:-12px; width:9px; height:14px; border-radius:2px; animation: gFall 1.6s linear forwards; }
      @keyframes gFall{ to{ transform: translateY(420px) rotate(540deg); opacity:0 } }
      input::placeholder{ color:#B7AED0 }
      @media (max-width:480px){ h1{font-size:26px} }
    `}</style>
  );
}
