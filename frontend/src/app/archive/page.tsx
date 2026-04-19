"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NavShell } from "@/components/NavShell";
import { triggerPageTransition } from "@/components/TransitionOverlay";

/* ── Demo data — fields mirror `user_dreams` table in Supabase ── */
interface DreamEntry {
  id: string;
  title: string;                  // derived (agent-generated)
  date: string;                   // recorded_at, formatted
  raw_text: string;               // raw_text
  emotion_tags: string[];         // emotion_tags[]
  symbol_tags: string[];          // symbol_tags[]
  character_tags: string[];       // character_tags[]
  interaction_type: string;       // interaction_type
  lucidity_score: number;         // 0–1
  vividness_score: number;        // 0–1
  // Agent-generated notes (not DB columns; produced by interpreter subagent)
  interpretation: string;
  subconsciousEmotion: string;
  realLifeCorrelation: string;
}

const DREAMS: DreamEntry[] = [
  {
    id: "d1",
    title: "Water under the old house",
    date: "Mar 19",
    raw_text: "I walked through deep water beneath a night-blue sky, looking for my childhood house. It felt far away, but I kept moving.",
    emotion_tags: ["gentle anxiety", "longing"],
    symbol_tags: ["water", "house", "night sky"],
    character_tags: ["childhood self"],
    interaction_type: "solitary search",
    lucidity_score: 0.32,
    vividness_score: 0.74,
    interpretation: "Less crisis than return. Water carries feeling, and the house points back to safety.",
    subconsciousEmotion: "Gentle tension, noticed rather than overwhelming.",
    realLifeCorrelation: "This often appears around shifts in role, place, or closeness.",
  },
  {
    id: "d2",
    title: "Flooded basement",
    date: "Mar 14",
    raw_text: "The basement was full of dark water, rising slowly. I was looking for something I'd left behind but couldn't remember what.",
    emotion_tags: ["urgency", "searching"],
    symbol_tags: ["water", "basement", "forgotten object"],
    character_tags: [],
    interaction_type: "solitary search",
    lucidity_score: 0.41,
    vividness_score: 0.68,
    interpretation: "A familiar motif: something submerged needs retrieval. The forgetting suggests the search matters more than the object.",
    subconsciousEmotion: "Controlled urgency — aware of the situation but not panicking.",
    realLifeCorrelation: "Often tied to unfinished tasks or conversations you're avoiding.",
  },
  {
    id: "d3",
    title: "Rain after the argument",
    date: "Mar 08",
    raw_text: "After a tense conversation I can't recall, I walked outside into warm rain. Everything felt washed.",
    emotion_tags: ["release", "relief"],
    symbol_tags: ["rain", "warmth", "clearing"],
    character_tags: ["unseen other"],
    interaction_type: "aftermath",
    lucidity_score: 0.28,
    vividness_score: 0.62,
    interpretation: "The rain acts as emotional reset. The forgotten argument suggests it was the tension, not the topic, that mattered.",
    subconsciousEmotion: "Relief arriving without resolution.",
    realLifeCorrelation: "Appears when you process conflict through distance rather than confrontation.",
  },
  {
    id: "d4",
    title: "Running beside the river",
    date: "Feb 27",
    raw_text: "I was running along a river at dusk. Not away from anything — toward something I could feel but not see.",
    emotion_tags: ["tense focus", "anticipation"],
    symbol_tags: ["river", "dusk", "movement"],
    character_tags: [],
    interaction_type: "pursuit",
    lucidity_score: 0.46,
    vividness_score: 0.81,
    interpretation: "Pursuit without clear target often signals intuitive direction. The river is pace, not danger.",
    subconsciousEmotion: "Forward momentum, purposeful but unsure of the destination.",
    realLifeCorrelation: "Common during periods of professional ambiguity or career transitions.",
  },
];

const SOURCES = [
  { title: "Hall / Van de Castle coding manual", note: "Used to compare repeated elements." },
  { title: "DreamBank community records", note: "Used to compare calm dreams shaped by water and childhood places." },
  { title: "DreamBank dreams dataset", note: "Used to compare nocturnal water imagery." },
];

/** Build suggested prompts from the dream's actual tags.
 *  Keeps chat grounded in what the DB knows rather than a canned list. */
function buildPrompts(d: DreamEntry): string[] {
  const out: string[] = [];
  if (d.symbol_tags[0]) out.push(`What does “${d.symbol_tags[0]}” mean for you here?`);
  if (d.emotion_tags[0]) out.push(`When has ${d.emotion_tags[0]} shown up before?`);
  if (d.character_tags[0]) out.push(`Who is the ${d.character_tags[0]}?`);
  out.push("How does this compare to last month?");
  return out.slice(0, 4);
}

const EMOTION_COLOR: Record<string, string> = {
  "gentle anxiety": "#8ba6d4",
  "urgency": "#c98787",
  "release": "#a8c9a3",
  "tense focus": "#c4a574",
};

type Drawer = "sources" | "chat" | null;

export default function ArchivePage() {
  const [selected, setSelected] = useState(0);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [chatInputValue, setChatInputValue] = useState("");
  const railRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const dream = DREAMS[selected];

  // Prefetch dashboard so follow-up questions navigate instantly
  useEffect(() => { router.prefetch("/dashboard"); }, [router]);

  /** Mirrors the landing-page flow in `(chat)/page.tsx`: pack the dream's
   *  real DB context + the user's question into sessionStorage, then
   *  navigate to /dashboard, which picks it up on mount and runs the agent. */
  const sendToAgent = useCallback((question: string) => {
    const q = question.trim();
    if (!q) return;
    const lines = [
      `Follow-up on my dream from ${dream.date}:`,
      `"${dream.raw_text}"`,
      "",
      `Emotions: ${dream.emotion_tags.join(", ") || "—"}`,
      `Symbols: ${dream.symbol_tags.join(", ") || "—"}`,
      dream.character_tags.length ? `Characters: ${dream.character_tags.join(", ")}` : null,
      `Interaction: ${dream.interaction_type}`,
      `Lucidity: ${(dream.lucidity_score * 100).toFixed(0)}%  ·  Vividness: ${(dream.vividness_score * 100).toFixed(0)}%`,
      "",
      `Question: ${q}`,
    ].filter(Boolean).join("\n");
    sessionStorage.setItem("dreamrag_dream", lines);
    triggerPageTransition();
    setTimeout(() => router.push("/dashboard"), 350);
  }, [dream, router]);

  useEffect(() => {
    const prev = () => setSelected(s => (s - 1 + DREAMS.length) % DREAMS.length);
    const next = () => setSelected(s => (s + 1) % DREAMS.length);
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "/") { e.preventDefault(); setDrawer(d => d === "chat" ? null : "chat"); }
      else if (e.key === "s" || e.key === "S") setDrawer(d => d === "sources" ? null : "sources");
      else if (e.key === "Escape") setDrawer(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const active = rail.querySelector<HTMLElement>(`[data-idx="${selected}"]`);
    if (active) active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected]);

  const prevDream = () => setSelected(s => (s - 1 + DREAMS.length) % DREAMS.length);
  const nextDream = () => setSelected(s => (s + 1) % DREAMS.length);

  return (
    <div style={root}>
      <div style={backdrop} />
      <div style={glowTop} />
      <NavShell />

      <div style={wrap}>
        <header style={hdr}>
          <div style={hdrLeft}>
            <small style={eyebrowLabel}>Archive</small>
            <h1 style={pageTitle}>Every dream you&apos;ve chosen to keep.</h1>
          </div>
          <div style={keyGrid}>
            <div style={keyCell}>
              <div style={keyRow}>
                <span style={hintKey}>←</span>
                <span style={hintKey}>→</span>
              </div>
              <span style={keyLabel}>flip</span>
            </div>
            <div style={keyCell}>
              <div style={keyRow}><span style={hintKey}>S</span></div>
              <span style={keyLabel}>sources</span>
            </div>
            <div style={keyCell}>
              <div style={keyRow}><span style={hintKey}>/</span></div>
              <span style={keyLabel}>chat</span>
            </div>
          </div>
        </header>

        <main style={stage}>
          <button style={{ ...navBtn, left: 4 }} onClick={prevDream} aria-label="Previous dream" type="button">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 3L5 9l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <article key={dream.id} style={{ ...glass, ...journalCard }}>
            <div style={journalInner}>
              <div style={journalHead}>
                <div style={journalMeta}>
                  <span style={journalMetaDate}>{dream.date}, 2026</span>
                  <span style={journalMetaSep}>·</span>
                  <span style={journalMetaCount}>
                    {String(selected + 1).padStart(2, "0")} / {String(DREAMS.length).padStart(2, "0")}
                  </span>
                </div>
                <div style={iconRow}>
                  <button
                    style={{ ...iconBtn, ...(drawer === "sources" ? iconBtnActive : {}) }}
                    onClick={() => setDrawer(d => d === "sources" ? null : "sources")}
                    aria-label="Sources (press s)"
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 2.5h3.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 0-1.5-1.5H2v-8zM12 2.5H8.5A1.5 1.5 0 0 0 7 4v8a1.5 1.5 0 0 1 1.5-1.5H12v-8z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    style={{ ...iconBtn, ...(drawer === "chat" ? iconBtnActive : {}) }}
                    onClick={() => setDrawer(d => d === "chat" ? null : "chat")}
                    aria-label="Follow-up chat (press /)"
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 5.5a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H6l-2.5 1.8V9.5a3 3 0 0 1-1-2.2v-1.8z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <h2 style={detailTitle}>{dream.title}</h2>

              <div style={tagRow}>
                {dream.symbol_tags.map(t => <span key={t} style={tagSmall}>{t}</span>)}
              </div>

              <p style={rawDream}>&ldquo;{dream.raw_text}&rdquo;</p>

              <div style={divider} />

              <section style={detailBlock}>
                <small style={detailBlockLabel}>Interpretation</small>
                <p style={detailBlockText}>{dream.interpretation}</p>
              </section>

              <div style={splitRow}>
                <section style={detailBlock}>
                  <small style={detailBlockLabel}>Subconscious Emotion</small>
                  <p style={detailBlockText}>{dream.subconsciousEmotion}</p>
                </section>
                <section style={detailBlock}>
                  <small style={detailBlockLabel}>Real-life Correlation</small>
                  <p style={detailBlockText}>{dream.realLifeCorrelation}</p>
                </section>
              </div>
            </div>
          </article>

          <button style={{ ...navBtn, right: 4 }} onClick={nextDream} aria-label="Next dream" type="button">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 3l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </main>

        <div style={railWrap}>
          <div ref={railRef} style={rail}>
            {DREAMS.map((d, i) => (
              <button
                key={d.id}
                data-idx={i}
                onClick={() => setSelected(i)}
                style={{
                  ...railCard,
                  ...(selected === i ? railCardActive : {}),
                }}
                type="button"
              >
                <small style={railDate}>{d.date}</small>
                <strong style={railTitle}>{d.title}</strong>
                <div style={railEmotionRow}>
                  <span style={{ ...emotionDot, background: EMOTION_COLOR[d.emotion_tags[0]] ?? "#a8a8b8" }} />
                  <span style={railEmotion}>{d.emotion_tags[0]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

      {drawer && <div style={scrim} onClick={() => setDrawer(null)} />}

      <aside style={{ ...drawerStyle, transform: drawer === "sources" ? "translateX(0)" : "translateX(110%)" }}>
        <div style={drawerInner}>
          <div style={panelHead}>
            <div>
              <strong style={panelHeadStrong}>Sources</strong>
              <span style={panelHeadSub}>Behind this note</span>
            </div>
            <button style={closeBtn} onClick={() => setDrawer(null)} aria-label="Close" type="button">×</button>
          </div>
          <div style={sourceStack}>
            {SOURCES.map(s => (
              <div key={s.title} style={sourceItem}>
                <strong style={sourceName}>{s.title}</strong>
                <p style={sourceMuted}>{s.note}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <aside style={{ ...drawerStyle, transform: drawer === "chat" ? "translateX(0)" : "translateX(110%)" }}>
        <div style={drawerInner}>
          <div style={panelHead}>
            <div>
              <strong style={panelHeadStrong}>Ask about this dream</strong>
              <span style={panelHeadSub}>{dream.date}, 2026 · {dream.title}</span>
            </div>
            <button style={closeBtn} onClick={() => setDrawer(null)} aria-label="Close" type="button">×</button>
          </div>

          {/* Facts the model has — pulled from user_dreams row */}
          <section style={factsBlock}>
            <div style={factRow}>
              <small style={factLabel}>Emotions</small>
              <div style={chipWrap}>
                {dream.emotion_tags.map(t => (
                  <span key={t} style={{ ...chip, ...chipEmotion, ["--dot" as string]: EMOTION_COLOR[t] ?? "#a8a8b8" } as React.CSSProperties}>
                    <span style={{ ...chipDot, background: EMOTION_COLOR[t] ?? "#a8a8b8" }} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div style={factRow}>
              <small style={factLabel}>Symbols</small>
              <div style={chipWrap}>
                {dream.symbol_tags.map(t => <span key={t} style={{ ...chip, ...chipSymbol }}>{t}</span>)}
              </div>
            </div>
            {dream.character_tags.length > 0 && (
              <div style={factRow}>
                <small style={factLabel}>Characters</small>
                <div style={chipWrap}>
                  {dream.character_tags.map(t => <span key={t} style={{ ...chip, ...chipCharacter }}>{t}</span>)}
                </div>
              </div>
            )}
            <div style={factRow}>
              <small style={factLabel}>Interaction</small>
              <div style={chipWrap}>
                <span style={{ ...chip, ...chipNeutral }}>{dream.interaction_type}</span>
              </div>
            </div>
            <div style={scoreRow}>
              <ScoreBar label="Lucidity" value={dream.lucidity_score} />
              <ScoreBar label="Vividness" value={dream.vividness_score} />
            </div>
          </section>

          <div style={thinDivider} />

          {/* Prompts — generated from this dream's tags */}
          <small style={factLabel}>Where to start</small>
          <div style={promptGrid}>
            {buildPrompts(dream).map(p => (
              <button key={p} style={promptCard} type="button" onClick={() => sendToAgent(p)}>
                <span style={promptCardText}>{p}</span>
                <span style={promptCardArrow}>↗</span>
              </button>
            ))}
          </div>

          <div style={chatInput}>
            <input
              style={chatFieldInput}
              placeholder="Ask about this dream…"
              type="text"
              value={chatInputValue}
              onChange={(e) => setChatInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && chatInputValue.trim()) {
                  e.preventDefault();
                  sendToAgent(chatInputValue);
                }
              }}
            />
            <button
              style={{ ...sendBtn, opacity: chatInputValue.trim() ? 1 : 0.45, cursor: chatInputValue.trim() ? "pointer" : "default" }}
              type="button"
              aria-label="Send"
              disabled={!chatInputValue.trim()}
              onClick={() => sendToAgent(chatInputValue)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1.5 7h11M8.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes journalIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .archive-rail::-webkit-scrollbar { height: 6px; }
        .archive-rail::-webkit-scrollbar-thumb { background: rgba(64,56,82,0.14); border-radius: 999px; }
        .archive-rail::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={scoreCell}>
      <div style={scoreHead}>
        <span style={scoreName}>{label}</span>
        <span style={scoreValue}>{pct.toFixed(0)}%</span>
      </div>
      <div style={scoreTrack}>
        <div style={{ ...scoreFill, width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Styles — warm frost glass, same backdrop as landing + profile
   ───────────────────────────────────────────────────────────────────────────── */

const root: React.CSSProperties = { position: "relative", height: "100dvh", width: "100vw", fontFamily: '"Manrope", sans-serif', color: "#403852", overflow: "hidden" };

const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 0,
  background: `
    radial-gradient(circle at 12% 18%, rgba(140, 180, 200, 0.4), transparent 24%),
    radial-gradient(circle at 84% 10%, rgba(160, 150, 210, 0.5), transparent 30%),
    radial-gradient(circle at 82% 82%, rgba(200, 150, 170, 0.4), transparent 24%),
    radial-gradient(circle at 28% 74%, rgba(130, 160, 210, 0.35), transparent 22%),
    linear-gradient(160deg, #d0c8c0 0%, #c8c0d4 46%, #d4cec4 100%)
  `,
};

const glowTop: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
  background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.35), transparent 40%)",
};

const wrap: React.CSSProperties = {
  position: "relative", zIndex: 1,
  height: "100dvh",
  maxWidth: 1280, width: "min(calc(100% - 34px), 1280px)",
  margin: "0 auto",
  paddingTop: 68, paddingBottom: 20,
  display: "grid", gap: 18,
  gridTemplateRows: "auto minmax(0, 1fr) auto",
};

/* ── Header ── */
const hdr: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 };
const hdrLeft: React.CSSProperties = { minWidth: 0 };
const eyebrowLabel: React.CSSProperties = { display: "block", marginBottom: 8, fontSize: "0.74rem", fontWeight: 800, color: "rgba(64, 56, 82, 0.45)", letterSpacing: "0.22em", textTransform: "uppercase" };
const pageTitle: React.CSSProperties = { margin: 0, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: "clamp(2.4rem, 3.4vw, 4.2rem)", lineHeight: 0.96, letterSpacing: "-0.03em", color: "#403852" };

/* ── Keyboard hint grid (top-right, aligned with title baseline) ── */
const keyGrid: React.CSSProperties = {
  display: "grid", gridAutoFlow: "column", gap: 10,
  padding: "10px 12px", borderRadius: 18,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0.36))",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 10px 22px rgba(118, 109, 150, 0.05)",
  backdropFilter: "blur(16px) saturate(140%)",
  flexShrink: 0,
};
const keyCell: React.CSSProperties = {
  display: "grid", gap: 5, justifyItems: "center",
  padding: "4px 8px",
};
const keyRow: React.CSSProperties = { display: "flex", gap: 4 };
const keyLabel: React.CSSProperties = {
  fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
  color: "rgba(64, 56, 82, 0.48)",
};

/* ── Stage (journal + side arrows) ── */
const stage: React.CSSProperties = {
  position: "relative",
  display: "flex", justifyContent: "center", alignItems: "stretch",
  minHeight: 0,
};

const navBtn: React.CSSProperties = {
  position: "absolute", top: "50%", transform: "translateY(-50%)",
  width: 44, height: 44, borderRadius: 999,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.5))",
  border: "1px solid rgba(255, 255, 255, 0.8)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 10px 22px rgba(118, 109, 150, 0.08)",
  backdropFilter: "blur(16px) saturate(140%)",
  color: "rgba(64, 56, 82, 0.7)",
  display: "grid", placeItems: "center",
  cursor: "pointer", zIndex: 2,
};

/* ── Glass — warm frost ── */
const glass: React.CSSProperties = {
  position: "relative", overflow: "hidden", borderRadius: 32,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.68), rgba(255, 255, 255, 0.42))",
  border: "1px solid rgba(255, 255, 255, 0.75)",
  backdropFilter: "blur(24px) saturate(145%)",
  boxShadow: "0 30px 72px rgba(96, 82, 124, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.82)",
};

const journalCard: React.CSSProperties = {
  width: "min(100%, 820px)",
  height: "100%",
  display: "flex", flexDirection: "column",
  animation: "journalIn 240ms ease",
};

const journalInner: React.CSSProperties = {
  position: "relative", zIndex: 1,
  padding: "28px 40px 32px",
  display: "grid", gap: 18, alignContent: "start",
  overflowY: "auto",
  flex: 1,
  minHeight: 0,
};

const journalHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 };

const journalMeta: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
  color: "rgba(64, 56, 82, 0.5)",
};
const journalMetaDate: React.CSSProperties = { color: "rgba(64, 56, 82, 0.6)" };
const journalMetaSep: React.CSSProperties = { color: "rgba(64, 56, 82, 0.28)" };
const journalMetaCount: React.CSSProperties = { color: "rgba(64, 56, 82, 0.42)", letterSpacing: "0.18em" };

const iconRow: React.CSSProperties = { display: "flex", gap: 8 };

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 12, border: 0, cursor: "pointer",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.5))",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 6px 14px rgba(118, 109, 150, 0.06)",
  color: "rgba(64, 56, 82, 0.6)",
  display: "grid", placeItems: "center",
  transition: "transform 160ms ease, box-shadow 160ms ease",
};

const iconBtnActive: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(232, 236, 255, 0.92), rgba(244, 246, 255, 0.7))",
  color: "rgba(87, 97, 191, 0.9)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 10px 20px rgba(108, 117, 191, 0.15)",
};

/* ── Tags ── */
const tagSmall: React.CSSProperties = {
  display: "inline-flex", padding: "5px 11px", borderRadius: 999,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.56))",
  border: "1px solid rgba(255, 255, 255, 0.78)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 6px 12px rgba(118, 109, 150, 0.04)",
  fontSize: "0.72rem", fontWeight: 700, color: "rgba(64, 56, 82, 0.58)", letterSpacing: "0.02em",
};

const tagRow: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };

/* ── Detail / journal body ── */
const detailTitle: React.CSSProperties = {
  margin: 0,
  fontFamily: '"Cormorant Garamond", serif', fontWeight: 500,
  fontSize: "clamp(2rem, 2.8vw, 3rem)", lineHeight: 1.02, letterSpacing: "-0.025em",
  color: "#403852",
};

const rawDream: React.CSSProperties = {
  margin: 0,
  fontFamily: '"Cormorant Garamond", serif', fontStyle: "italic", fontWeight: 400,
  fontSize: "clamp(1.15rem, 1.45vw, 1.45rem)", lineHeight: 1.55, letterSpacing: "-0.005em",
  color: "rgba(64, 56, 82, 0.78)",
};

const divider: React.CSSProperties = {
  height: 1, width: "100%",
  background: "linear-gradient(90deg, transparent, rgba(64, 56, 82, 0.14), transparent)",
  margin: "2px 0",
};

const detailBlock: React.CSSProperties = { display: "grid", gap: 6 };
const detailBlockLabel: React.CSSProperties = { fontSize: "0.7rem", fontWeight: 800, color: "rgba(64, 56, 82, 0.42)", letterSpacing: "0.14em", textTransform: "uppercase" };
const detailBlockText: React.CSSProperties = { margin: 0, fontSize: "0.92rem", color: "rgba(64, 56, 82, 0.72)", lineHeight: 1.65 };

const splitRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, marginTop: 4 };

/* ── Rail (horizontal thumbnails) ── */
const railWrap: React.CSSProperties = {
  padding: "0 4px",
};

const rail: React.CSSProperties = {
  display: "flex", gap: 10,
  overflowX: "auto", overflowY: "hidden",
  scrollSnapType: "x proximity",
  padding: "6px 4px 8px",
  WebkitOverflowScrolling: "touch",
};

const railCard: React.CSSProperties = {
  flex: "0 0 auto",
  width: 170,
  textAlign: "left" as const, cursor: "pointer",
  padding: "10px 12px", borderRadius: 16, border: 0,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0.3))",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.62), 0 6px 14px rgba(118, 109, 150, 0.04)",
  backdropFilter: "blur(14px) saturate(140%)",
  display: "grid", gap: 6,
  fontFamily: '"Manrope", sans-serif', color: "#403852",
  transition: "transform 200ms ease, box-shadow 200ms ease, background 200ms ease, opacity 200ms ease",
  opacity: 0.66,
  scrollSnapAlign: "center",
};

const railCardActive: React.CSSProperties = {
  opacity: 1,
  transform: "translateY(-3px) scale(1.03)",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.62))",
  boxShadow: "0 16px 34px rgba(96, 82, 124, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.88)",
};

const railDate: React.CSSProperties = { fontSize: "0.68rem", fontWeight: 800, color: "rgba(64, 56, 82, 0.45)", letterSpacing: "0.14em", textTransform: "uppercase" };
const railTitle: React.CSSProperties = { fontSize: "0.86rem", fontWeight: 700, lineHeight: 1.25, color: "#403852", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" };
const railEmotionRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, marginTop: 2 };
const emotionDot: React.CSSProperties = { width: 7, height: 7, borderRadius: 999, flexShrink: 0 };
const railEmotion: React.CSSProperties = { fontSize: "0.74rem", color: "rgba(64, 56, 82, 0.58)" };

/* ── Keycap ── */
const hintKey: React.CSSProperties = {
  display: "inline-grid", placeItems: "center",
  minWidth: 24, height: 24, padding: "0 7px", borderRadius: 7,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.66))",
  border: "1px solid rgba(255, 255, 255, 0.8)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 3px 6px rgba(118, 109, 150, 0.06)",
  fontSize: "0.78rem", fontWeight: 700, color: "rgba(64, 56, 82, 0.7)",
  lineHeight: 1,
};

/* ── Drawer ── */
const scrim: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 20,
  background: "rgba(40, 34, 56, 0.12)",
  backdropFilter: "blur(2px)",
};

const drawerStyle: React.CSSProperties = {
  position: "fixed", top: 16, right: 16, bottom: 16, zIndex: 21,
  width: "min(420px, calc(100vw - 32px))",
  borderRadius: 26,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.5))",
  border: "1px solid rgba(255, 255, 255, 0.78)",
  backdropFilter: "blur(26px) saturate(150%)",
  boxShadow: "0 34px 80px rgba(96, 82, 124, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.86)",
  transition: "transform 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
  overflow: "hidden",
};

const drawerInner: React.CSSProperties = {
  height: "100%", padding: 22,
  display: "flex", flexDirection: "column", gap: 14,
  overflowY: "auto",
};

const panelHead: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 12,
  padding: "12px 14px", borderRadius: 20,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.58))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 10px 20px rgba(118, 109, 150, 0.05)",
};

const panelHeadStrong: React.CSSProperties = { display: "block", fontSize: "0.92rem", fontWeight: 800 };
const panelHeadSub: React.CSSProperties = { fontSize: "0.78rem", color: "rgba(64, 56, 82, 0.55)" };

const closeBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 10, border: 0, cursor: "pointer",
  background: "rgba(255, 255, 255, 0.6)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 4px 10px rgba(118, 109, 150, 0.06)",
  color: "rgba(64, 56, 82, 0.6)",
  fontSize: "1.2rem", lineHeight: 1,
  display: "grid", placeItems: "center",
};

/* ── Sources (inside drawer) ── */
const sourceStack: React.CSSProperties = { display: "grid", gap: 10 };

const sourceItem: React.CSSProperties = {
  padding: "14px", borderRadius: 18,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.42))",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.76), 0 8px 18px rgba(118, 109, 150, 0.04)",
  display: "grid", gap: 4,
};

const sourceName: React.CSSProperties = { display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#5761bf", letterSpacing: "0.01em" };
const sourceMuted: React.CSSProperties = { margin: 0, fontSize: "0.82rem", color: "rgba(64, 56, 82, 0.55)", lineHeight: 1.5 };

/* ── Chat drawer: facts block ── */
const factsBlock: React.CSSProperties = {
  display: "grid", gap: 12,
  padding: "16px 14px", borderRadius: 20,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0.3))",
  border: "1px solid rgba(255, 255, 255, 0.68)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.74), 0 8px 18px rgba(118, 109, 150, 0.04)",
};
const factRow: React.CSSProperties = { display: "grid", gap: 6 };
const factLabel: React.CSSProperties = {
  fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase",
  color: "rgba(64, 56, 82, 0.42)",
};
const chipWrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };

const chip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "5px 10px", borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.78)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 4px 10px rgba(118, 109, 150, 0.04)",
  fontSize: "0.74rem", fontWeight: 700, letterSpacing: "0.01em",
};
const chipEmotion: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.62))",
  color: "rgba(64, 56, 82, 0.75)",
};
const chipSymbol: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(238, 234, 252, 0.82), rgba(246, 244, 255, 0.58))",
  color: "rgba(99, 87, 156, 0.85)",
};
const chipCharacter: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(252, 236, 232, 0.82), rgba(255, 246, 242, 0.58))",
  color: "rgba(156, 95, 85, 0.85)",
};
const chipNeutral: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.48))",
  color: "rgba(64, 56, 82, 0.62)",
};
const chipDot: React.CSSProperties = { width: 7, height: 7, borderRadius: 999, flexShrink: 0 };

const scoreRow: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12,
  marginTop: 4,
};
const scoreCell: React.CSSProperties = { display: "grid", gap: 5 };
const scoreHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "0.72rem" };
const scoreName: React.CSSProperties = { fontWeight: 700, color: "rgba(64, 56, 82, 0.65)", letterSpacing: "0.02em" };
const scoreValue: React.CSSProperties = { fontWeight: 700, color: "rgba(87, 97, 191, 0.85)", fontVariantNumeric: "tabular-nums" };
const scoreTrack: React.CSSProperties = {
  height: 5, borderRadius: 999, overflow: "hidden",
  background: "rgba(64, 56, 82, 0.09)",
  border: "1px solid rgba(255, 255, 255, 0.6)",
};
const scoreFill: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #9aa3e3, #6d78d4)",
  borderRadius: 999,
  transition: "width 280ms ease",
};

const thinDivider: React.CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent, rgba(64, 56, 82, 0.14), transparent)",
  margin: "2px 0",
};

/* ── Prompt grid ── */
const promptGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr", gap: 8,
};
const promptCard: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
  padding: "12px 14px", borderRadius: 16, border: 0, cursor: "pointer",
  textAlign: "left" as const,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.5))",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 6px 14px rgba(118, 109, 150, 0.05)",
  transition: "transform 160ms ease, box-shadow 160ms ease",
};
const promptCardText: React.CSSProperties = {
  fontSize: "0.84rem", fontWeight: 600, color: "rgba(64, 56, 82, 0.78)", lineHeight: 1.4,
};
const promptCardArrow: React.CSSProperties = {
  fontSize: "0.9rem", color: "rgba(87, 97, 191, 0.75)", flexShrink: 0,
};

/* ── Chat input ── */
const chatInput: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "minmax(0, 1fr) 46px", gap: 8, alignItems: "center",
  padding: 8, borderRadius: 20,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.42))",
  border: "1px solid rgba(255, 255, 255, 0.78)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 10px 20px rgba(118, 109, 150, 0.05)",
  marginTop: "auto",
  flexShrink: 0,
};

const chatFieldInput: React.CSSProperties = {
  padding: "12px 14px", borderRadius: 14,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.6))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
  fontSize: "0.84rem", color: "rgba(64, 56, 82, 0.72)", lineHeight: 1.52,
  outline: "none",
  fontFamily: '"Manrope", sans-serif',
};

const sendBtn: React.CSSProperties = {
  width: 46, height: 46, borderRadius: 14, border: 0, cursor: "pointer",
  background: "linear-gradient(180deg, #7e87df, #646dcb)",
  color: "white",
  display: "grid", placeItems: "center",
  boxShadow: "0 10px 22px rgba(101, 111, 208, 0.2)",
};
