"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NavShell } from "@/components/NavShell";
import { triggerPageTransition } from "@/components/TransitionOverlay";

/* ── Types matching user_dreams table in Supabase ── */
interface DreamEntry {
  id: string;
  title: string;           // derived from raw_text (first few words)
  date: string;            // recorded_at, formatted as "Mar 19"
  raw_text: string;
  emotion_tags: string[];
  symbol_tags: string[];
  character_tags: string[];
  interaction_type: string;
  lucidity_score: number;
  vividness_score: number;
  hvdc_codes: Record<string, unknown>;
}

/* ── DB row shape returned by /api/user-dreams ── */
interface DreamRow {
  id: number;
  raw_text: string;
  recorded_at: string;
  emotion_tags: string[] | null;
  symbol_tags: string[] | null;
  character_tags: string[] | null;
  interaction_type: string | null;
  lucidity_score: number | null;
  vividness_score: number | null;
  hvdc_codes: Record<string, unknown> | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dreamTitle(raw_text: string): string {
  const words = raw_text.trim().split(/\s+/);
  const slice = words.slice(0, 7).join(" ");
  return words.length > 7 ? slice + "…" : slice;
}

function rowToEntry(row: DreamRow): DreamEntry {
  return {
    id: String(row.id),
    title: dreamTitle(row.raw_text),
    date: formatDate(row.recorded_at),
    raw_text: row.raw_text,
    emotion_tags: row.emotion_tags ?? [],
    symbol_tags: row.symbol_tags ?? [],
    character_tags: row.character_tags ?? [],
    interaction_type: row.interaction_type ?? "",
    lucidity_score: row.lucidity_score ?? 0,
    vividness_score: row.vividness_score ?? 0,
    hvdc_codes: row.hvdc_codes ?? {},
  };
}

const SOURCES = [
  { title: "Hall / Van de Castle coding manual", note: "Used to compare repeated elements." },
  { title: "DreamBank community records", note: "Used to compare calm dreams shaped by water and childhood places." },
  { title: "DreamBank dreams dataset", note: "Used to compare nocturnal water imagery." },
];

/* ── Emotion dot palette — maps any common tag to a colour ── */
const EMOTION_PALETTE: Record<string, string> = {
  anxiety: "#8ba6d4", fear: "#8ba6d4", dread: "#8ba6d4",
  joy: "#e8c47d", happiness: "#e8c47d", bliss: "#e8c47d",
  sadness: "#a8a8c8", grief: "#a8a8c8",
  anger: "#c98787", rage: "#c98787",
  peace: "#a8c9a3", calm: "#a8c9a3", serenity: "#a8c9a3",
  excitement: "#c4a574", anticipation: "#c4a574",
  love: "#e89ba8", affection: "#e89ba8",
  loneliness: "#8b94a8", isolation: "#8b94a8",
  guilt: "#b098b8", shame: "#b098b8",
  wonder: "#e8c47d", awe: "#e8c47d",
  confusion: "#b0a8c4",
  urgency: "#c98787", searching: "#b0a8c4",
  release: "#a8c9a3", relief: "#a8c9a3",
  "gentle anxiety": "#8ba6d4", "tense focus": "#c4a574",
};

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

function emotionColor(tag: string): string {
  const key = tag.toLowerCase();
  for (const [k, v] of Object.entries(EMOTION_PALETTE)) {
    if (key.includes(k)) return v;
  }
  return "#a8a8b8";
}

type Drawer = "sources" | "chat" | null;

export default function ArchivePage() {
  const [dreams, setDreams] = useState<DreamEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [chatInputValue, setChatInputValue] = useState("");
  const railRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/user-dreams?user_id=demo_dreamer")
      .then(r => r.json())
      .then((d: { dreams: DreamRow[] }) => {
        setDreams((d.dreams ?? []).map(rowToEntry));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const dream = dreams[selected];

  // Prefetch dashboard so follow-up questions navigate instantly
  useEffect(() => { router.prefetch("/dashboard"); }, [router]);

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
    const prev = () => setSelected(s => (s - 1 + dreams.length) % Math.max(1, dreams.length));
    const next = () => setSelected(s => (s + 1) % Math.max(1, dreams.length));
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
  }, [dreams.length]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const active = rail.querySelector<HTMLElement>(`[data-idx="${selected}"]`);
    if (active) active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected]);

  const prevDream = () => setSelected(s => (s - 1 + dreams.length) % Math.max(1, dreams.length));
  const nextDream = () => setSelected(s => (s + 1) % Math.max(1, dreams.length));

  if (loading) {
    return (
      <div style={root}>
        <div style={backdrop} />
        <div style={glowTop} />
        <NavShell />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh" }}>
          <p style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: "1.1rem", fontStyle: "italic", color: "rgba(64,56,82,0.45)", letterSpacing: "0.04em" }}>
            Loading dreams…
          </p>
        </div>
      </div>
    );
  }

  if (dreams.length === 0) {
    return (
      <div style={root}>
        <div style={backdrop} />
        <div style={glowTop} />
        <NavShell />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", gap: 12 }}>
          <p style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: "1.6rem", color: "#403852", letterSpacing: "-0.02em" }}>No dreams recorded yet.</p>
          <p style={{ fontSize: "0.9rem", color: "rgba(64,56,82,0.5)" }}>
            Start in <a href="/dashboard" style={{ color: "#5761bf", fontWeight: 800, textDecoration: "none" }}>Dashboard</a> — your dreams will appear here.
          </p>
        </div>
      </div>
    );
  }

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
                    {String(selected + 1).padStart(2, "0")} / {String(dreams.length).padStart(2, "0")}
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

              <div style={factsGrid}>
                {dream.emotion_tags.length > 0 && (
                  <section style={detailBlock}>
                    <small style={detailBlockLabel}>Emotions</small>
                    <div style={chipWrap}>
                      {dream.emotion_tags.map(t => (
                        <span key={t} style={{ ...chip, ...chipEmotion }}>
                          <span style={{ ...chipDot, background: emotionColor(t) }} />
                          {t}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {dream.character_tags.length > 0 && (
                  <section style={detailBlock}>
                    <small style={detailBlockLabel}>Characters</small>
                    <div style={chipWrap}>
                      {dream.character_tags.map(t => (
                        <span key={t} style={{ ...chip, ...chipCharacter }}>{t}</span>
                      ))}
                    </div>
                  </section>
                )}

                {dream.interaction_type && (
                  <section style={detailBlock}>
                    <small style={detailBlockLabel}>Interaction</small>
                    <div style={chipWrap}>
                      <span style={{ ...chip, ...chipNeutral }}>{dream.interaction_type}</span>
                    </div>
                  </section>
                )}
              </div>

              <div style={scoreRow}>
                <ScoreBar label="Lucidity" value={dream.lucidity_score} />
                <ScoreBar label="Vividness" value={dream.vividness_score} />
              </div>

              {Object.keys(dream.hvdc_codes).length > 0 && (
                <section style={detailBlock}>
                  <small style={detailBlockLabel}>Hall / Van de Castle codes</small>
                  <div style={chipWrap}>
                    {Object.entries(dream.hvdc_codes).map(([k, v]) => (
                      <span key={k} style={{ ...chip, ...chipNeutral }}>
                        <span style={hvdcKey}>{k}</span>
                        <span style={hvdcVal}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </article>

          <button style={{ ...navBtn, right: 4 }} onClick={nextDream} aria-label="Next dream" type="button">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 3l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </main>

        <div style={railWrap}>
          <div ref={railRef} className="archive-rail" style={rail}>
            {dreams.map((d, i) => (
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
                  <span style={{ ...emotionDot, background: emotionColor(d.emotion_tags[0] ?? "") }} />
                  <span style={railEmotion}>{d.emotion_tags[0] ?? ""}</span>
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
                  <span key={t} style={{ ...chip, ...chipEmotion }}>
                    <span style={{ ...chipDot, background: emotionColor(t) }} />
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

const root: React.CSSProperties = { position: "relative", height: "100dvh", width: "100%", fontFamily: '"Manrope", sans-serif', color: "#403852", overflow: "hidden" };

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
  // minmax(0, 1fr) — without the 0 minimum, grid items with intrinsic
  // content larger than 1fr (the horizontal rail) would expand the column
  // past wrap's width, breaking overflow-x: auto on the rail.
  gridTemplateColumns: "minmax(0, 1fr)",
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
  overflowX: "hidden",
  flex: 1,
  minWidth: 0,
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
  overflowWrap: "anywhere",
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

const factsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 16,
  marginTop: 4,
};

const hvdcKey: React.CSSProperties = {
  fontWeight: 800, color: "rgba(64, 56, 82, 0.72)", letterSpacing: "0.04em",
};
const hvdcVal: React.CSSProperties = {
  marginLeft: 4, color: "rgba(64, 56, 82, 0.55)", fontVariantNumeric: "tabular-nums",
};

/* ── Rail (horizontal thumbnails) ── */
const railWrap: React.CSSProperties = {
  padding: "0 4px",
  minWidth: 0,
};

const rail: React.CSSProperties = {
  display: "flex", gap: 10,
  overflowX: "auto", overflowY: "hidden",
  scrollSnapType: "x proximity",
  padding: "6px 4px 8px",
  WebkitOverflowScrolling: "touch",
  minWidth: 0,
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
