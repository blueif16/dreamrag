"use client";

import { useState } from "react";
import { NavShell } from "@/components/NavShell";

/* ── Demo data ── */
interface DreamEntry {
  id: string;
  title: string;
  date: string;
  emotion: string;
  tags: string[];
  raw: string;
  interpretation: string;
  subconsciousEmotion: string;
  realLifeCorrelation: string;
}

const DREAMS: DreamEntry[] = [
  {
    id: "d1",
    title: "Water under the old house",
    date: "Mar 19",
    emotion: "gentle anxiety",
    tags: ["water", "house", "night"],
    raw: "I walked through deep water beneath a night-blue sky, looking for my childhood house. It felt far away, but I kept moving.",
    interpretation: "Less crisis than return. Water carries feeling, and the house points back to safety.",
    subconsciousEmotion: "Gentle tension, noticed rather than overwhelming.",
    realLifeCorrelation: "This often appears around shifts in role, place, or closeness.",
  },
  {
    id: "d2",
    title: "Flooded basement",
    date: "Mar 14",
    emotion: "urgency",
    tags: ["escape", "water"],
    raw: "The basement was full of dark water, rising slowly. I was looking for something I'd left behind but couldn't remember what.",
    interpretation: "A familiar motif: something submerged needs retrieval. The forgetting suggests the search matters more than the object.",
    subconsciousEmotion: "Controlled urgency — aware of the situation but not panicking.",
    realLifeCorrelation: "Often tied to unfinished tasks or conversations you're avoiding.",
  },
  {
    id: "d3",
    title: "Rain after the argument",
    date: "Mar 08",
    emotion: "release",
    tags: ["rain", "clearing"],
    raw: "After a tense conversation I can't recall, I walked outside into warm rain. Everything felt washed.",
    interpretation: "The rain acts as emotional reset. The forgotten argument suggests it was the tension, not the topic, that mattered.",
    subconsciousEmotion: "Relief arriving without resolution.",
    realLifeCorrelation: "Appears when you process conflict through distance rather than confrontation.",
  },
  {
    id: "d4",
    title: "Running beside the river",
    date: "Feb 27",
    emotion: "tense focus",
    tags: ["river", "movement"],
    raw: "I was running along a river at dusk. Not away from anything — toward something I could feel but not see.",
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

const CHAT = [
  { role: "user" as const, text: "What feels most similar between this dream and the rainy one?" },
  { role: "ai" as const, text: "Both are calm, but one leans toward release while this one leans toward belonging." },
];

const PROMPTS = ["Compare Mar 08", "Why the house?", "How is it changing?"];

export default function ArchivePage() {
  const [selected, setSelected] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const dream = DREAMS[selected];

  return (
    <div style={root}>
      <div style={backdrop} />
      <div style={glowTop} />
      <NavShell />

      <div style={wrap}>
        <header style={hdr}>
          <small style={eyebrowLabel}>Archive</small>
          <h1 style={pageTitle}>Every dream you&apos;ve chosen to keep.</h1>
        </header>

        <div style={archiveGrid}>
          {/* ── Left: History + Detail ── */}
          <section style={mainCol}>
            <div style={mainInner}>
              {/* History sidebar */}
              <aside style={{ ...glass, ...historyGlass }}>
                <div style={inner}>
                  <div style={panelHead}>
                    <div>
                      <strong style={panelHeadStrong}>Dream Archive</strong>
                      <span style={panelHeadSub}>{DREAMS.length} entries</span>
                    </div>
                    <span style={tagQuiet}>Recent</span>
                  </div>

                  <div style={historyList}>
                    {DREAMS.map((d, i) => (
                      <button
                        key={d.id}
                        onClick={() => setSelected(i)}
                        onMouseEnter={() => setHoveredItem(i)}
                        onMouseLeave={() => setHoveredItem(null)}
                        style={{
                          ...historyItem,
                          ...(selected === i ? historyItemActive : {}),
                          ...(hoveredItem === i && selected !== i ? historyItemHover : {}),
                        }}
                        type="button"
                      >
                        <strong style={historyTitle}>{d.title}</strong>
                        <p style={historyMeta}>{d.date} · {d.emotion}</p>
                        <div style={tagRow}>
                          {d.tags.map(t => <span key={t} style={selected === i ? tagActive : tagSmall}>{t}</span>)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              {/* Detail view */}
              <article style={{ ...glass, ...detailGlass }}>
                <div style={inner}>
                  <div style={panelHead}>
                    <div>
                      <strong style={panelHeadStrong}>{dream.date}, 2026</strong>
                      <span style={panelHeadSub}>Saved after reflection</span>
                    </div>
                    <div style={tagRow}>
                      {dream.tags.map(t => <span key={t} style={tagSmall}>{t}</span>)}
                    </div>
                  </div>

                  <h2 style={detailTitle}>{dream.title}</h2>

                  <div style={detailLayout}>
                    <DetailBlock label="Raw Dream" text={dream.raw} />
                    <DetailBlock label="Interpretation" text={dream.interpretation} />
                    <div style={splitRow}>
                      <DetailBlock label="Subconscious Emotion" text={dream.subconsciousEmotion} />
                      <DetailBlock label="Real-life Correlation" text={dream.realLifeCorrelation} />
                    </div>
                  </div>
                </div>
              </article>

              {/* Sources */}
              <article style={{ ...glass, maxWidth: 720, justifySelf: "center", width: "100%" }}>
                <div style={inner}>
                  <Eyebrow>Sources</Eyebrow>
                  <h3 style={sourceTitle}>Behind this note.</h3>
                  <div style={sourceStack}>
                    {SOURCES.map(s => (
                      <div key={s.title} style={sourceItem}>
                        <strong style={sourceName}>{s.title}</strong>
                        <p style={sourceMuted}>{s.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          </section>

          {/* ── Right: Follow-up chat ── */}
          <article style={{ ...glass, ...followupGlass }}>
            <div style={inner}>
              <div style={panelHead}>
                <div>
                  <strong style={panelHeadStrong}>Talking about</strong>
                  <span style={panelHeadSub}>{dream.title}</span>
                </div>
                <span style={tagQuiet}>Archive chat</span>
              </div>

              <h2 style={followupTitle}>Return to this dream.</h2>

              <div style={chatStack}>
                {CHAT.map((msg, i) => (
                  <div key={i} style={msg.role === "user" ? chatBubbleUser : chatBubbleAI}>
                    <strong style={chatRole}>{msg.role === "user" ? "You" : "DreamRAG"}</strong>
                    <p style={chatText}>{msg.text}</p>
                  </div>
                ))}
              </div>

              <div style={promptRow}>
                {PROMPTS.map(p => <span key={p} style={promptPill}>{p}</span>)}
              </div>

              <div style={chatInput}>
                <div style={chatField}>Does it lean more backward than the newer ones?</div>
                <button style={sendBtn} type="button" aria-label="Send">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.5 7h11M8.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

/* ── Tiny components ── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={eyebrowChip}>
      <span style={eyebrowDot} />
      {children}
    </div>
  );
}

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <section style={detailBlock}>
      <strong style={detailBlockLabel}>{label}</strong>
      <p style={detailBlockText}>{text}</p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Styles — warm frost glass, same backdrop as landing + profile
   ───────────────────────────────────────────────────────────────────────────── */

const root: React.CSSProperties = { position: "relative", minHeight: "100dvh", width: "100vw", fontFamily: '"Manrope", sans-serif', color: "#403852", overflowX: "hidden" };

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

const wrap: React.CSSProperties = { position: "relative", zIndex: 1, maxWidth: 1500, width: "min(calc(100% - 34px), 1500px)", margin: "0 auto", paddingTop: 80, paddingBottom: 80, paddingLeft: 60 };

const hdr: React.CSSProperties = { marginBottom: 32 };
const eyebrowLabel: React.CSSProperties = { display: "block", marginBottom: 10, fontSize: "0.74rem", fontWeight: 800, color: "rgba(64, 56, 82, 0.45)", letterSpacing: "0.22em", textTransform: "uppercase" };
const pageTitle: React.CSSProperties = { margin: 0, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: "clamp(2.9rem, 4vw, 5.1rem)", lineHeight: 0.94, letterSpacing: "-0.03em", color: "#403852" };

/* ── Layout ── */
const archiveGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.92fr) minmax(300px, 0.88fr)", gap: 18, alignItems: "start" };

const mainCol: React.CSSProperties = { minWidth: 0 };
const mainInner: React.CSSProperties = { display: "grid", gap: 18 };

/* ── Glass — warm frost ── */
const glass: React.CSSProperties = {
  position: "relative", overflow: "hidden", borderRadius: 28,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.38))",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  backdropFilter: "blur(24px) saturate(145%)",
  boxShadow: "0 24px 60px rgba(96, 82, 124, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
};

const historyGlass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0.32))",
  boxShadow: "0 20px 48px rgba(96, 82, 124, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.76)",
};

const detailGlass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.68), rgba(255, 255, 255, 0.42))",
};

const followupGlass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0.3))",
  boxShadow: "0 20px 48px rgba(96, 82, 124, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.74)",
};

const inner: React.CSSProperties = { position: "relative", zIndex: 1, padding: 24, display: "grid", gap: 16, alignContent: "start" };

/* ── Panel head ── */
const panelHead: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start", gap: 12,
  padding: "14px 16px", borderRadius: 22,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.58))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 12px 24px rgba(118, 109, 150, 0.06)",
  backdropFilter: "blur(16px) saturate(140%)",
};

const panelHeadStrong: React.CSSProperties = { display: "block", fontSize: "0.94rem", fontWeight: 800 };
const panelHeadSub: React.CSSProperties = { fontSize: "0.8rem", color: "rgba(64, 56, 82, 0.55)" };

/* ── Eyebrow chip ── */
const eyebrowChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, width: "max-content",
  padding: "7px 12px", borderRadius: 999,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.6))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.84), 0 8px 16px rgba(118, 109, 150, 0.05)",
  backdropFilter: "blur(14px) saturate(145%)",
  fontSize: "0.73rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const,
  color: "rgba(64, 56, 82, 0.55)",
};

const eyebrowDot: React.CSSProperties = { width: 7, height: 7, borderRadius: 999, background: "linear-gradient(180deg, #b6d5ff, #6b75d4)", flexShrink: 0 };

/* ── Tags ── */
const tagSmall: React.CSSProperties = {
  display: "inline-flex", padding: "6px 12px", borderRadius: 999,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.6))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.84), 0 8px 16px rgba(118, 109, 150, 0.05)",
  fontSize: "0.74rem", fontWeight: 700, color: "rgba(64, 56, 82, 0.6)", letterSpacing: "0.02em",
};

const tagActive: React.CSSProperties = {
  ...tagSmall,
  background: "linear-gradient(180deg, rgba(240, 243, 255, 0.94), rgba(248, 247, 255, 0.74))",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 12px 24px rgba(108, 117, 191, 0.1)",
  color: "rgba(87, 97, 191, 0.8)",
};

const tagQuiet: React.CSSProperties = {
  ...tagSmall,
  padding: "5px 10px", fontSize: "0.7rem",
};

const tagRow: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };

/* ── History list ── */
const historyList: React.CSSProperties = { display: "grid", gap: 10 };

const historyItem: React.CSSProperties = {
  textAlign: "left" as const, cursor: "pointer",
  padding: "16px", borderRadius: 20, border: "none",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.68), rgba(255, 255, 255, 0.44))",
  borderLeft: "none",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 10px 22px rgba(118, 109, 150, 0.05)",
  backdropFilter: "blur(16px) saturate(140%)",
  display: "grid", gap: 8,
  fontFamily: '"Manrope", sans-serif', color: "#403852",
  transition: "transform 180ms ease, box-shadow 180ms ease",
};

const historyItemActive: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.62))",
  boxShadow: "0 18px 44px rgba(96, 82, 124, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.85)",
  transform: "translateY(-2px)",
};

const historyItemHover: React.CSSProperties = {
  transform: "translateY(-1px)",
  boxShadow: "0 14px 34px rgba(96, 82, 124, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.82)",
};

const historyTitle: React.CSSProperties = { display: "block", fontSize: "0.88rem", fontWeight: 800, letterSpacing: "0.01em" };
const historyMeta: React.CSSProperties = { margin: 0, fontSize: "0.82rem", color: "rgba(64, 56, 82, 0.5)", lineHeight: 1.4 };

/* ── Detail ── */
const detailTitle: React.CSSProperties = { margin: 0, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: "clamp(2.2rem, 3vw, 3.2rem)", lineHeight: 0.94, letterSpacing: "-0.03em", color: "#403852" };

const detailLayout: React.CSSProperties = { display: "grid", gap: 14 };

const detailBlock: React.CSSProperties = {
  padding: "17px", borderRadius: 22,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.5))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 10px 22px rgba(118, 109, 150, 0.06)",
  backdropFilter: "blur(16px) saturate(140%)",
  display: "grid", gap: 8,
};

const detailBlockLabel: React.CSSProperties = { display: "block", fontSize: "0.73rem", fontWeight: 800, color: "rgba(64, 56, 82, 0.45)", letterSpacing: "0.12em", textTransform: "uppercase" as const };
const detailBlockText: React.CSSProperties = { margin: 0, fontSize: "0.9rem", color: "rgba(64, 56, 82, 0.7)", lineHeight: 1.65 };

const splitRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 };

/* ── Sources ── */
const sourceTitle: React.CSSProperties = { margin: 0, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: "clamp(1.6rem, 2vw, 2.1rem)", lineHeight: 0.98, letterSpacing: "-0.03em", color: "#403852" };

const sourceStack: React.CSSProperties = { display: "grid", gap: 10 };

const sourceItem: React.CSSProperties = {
  padding: "14px", borderRadius: 18,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.44))",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.76), 0 10px 22px rgba(118, 109, 150, 0.04)",
  display: "grid", gap: 4,
};

const sourceName: React.CSSProperties = { display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#5761bf", letterSpacing: "0.01em" };
const sourceMuted: React.CSSProperties = { margin: 0, fontSize: "0.82rem", color: "rgba(64, 56, 82, 0.55)", lineHeight: 1.5 };

/* ── Follow-up chat ── */
const followupTitle: React.CSSProperties = { margin: 0, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: "clamp(1.7rem, 2vw, 2.2rem)", lineHeight: 0.98, letterSpacing: "-0.03em", color: "#403852" };

const chatStack: React.CSSProperties = { display: "grid", gap: 10 };

const chatBubbleBase: React.CSSProperties = {
  padding: "14px", borderRadius: 20,
  border: "1px solid rgba(255, 255, 255, 0.82)",
  backdropFilter: "blur(16px) saturate(140%)",
  display: "grid", gap: 6,
};

const chatBubbleUser: React.CSSProperties = {
  ...chatBubbleBase,
  background: "linear-gradient(180deg, rgba(226, 232, 255, 0.86), rgba(244, 246, 255, 0.64))",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 12px 24px rgba(125, 135, 210, 0.06)",
};

const chatBubbleAI: React.CSSProperties = {
  ...chatBubbleBase,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.44))",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.76), 0 10px 22px rgba(118, 109, 150, 0.05)",
};

const chatRole: React.CSSProperties = { display: "block", fontSize: "0.73rem", fontWeight: 800, color: "rgba(64, 56, 82, 0.45)", letterSpacing: "0.12em", textTransform: "uppercase" as const };
const chatText: React.CSSProperties = { margin: 0, fontSize: "0.88rem", color: "rgba(64, 56, 82, 0.72)", lineHeight: 1.62 };

/* ── Prompt pills ── */
const promptRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };

const promptPill: React.CSSProperties = {
  padding: "9px 13px", borderRadius: 999,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.6))",
  border: "1px solid rgba(255, 255, 255, 0.78)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 8px 14px rgba(118, 109, 150, 0.04)",
  fontSize: "0.74rem", fontWeight: 700, color: "rgba(64, 56, 82, 0.6)", letterSpacing: "0.02em",
  cursor: "pointer",
};

/* ── Chat input ── */
const chatInput: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "minmax(0, 1fr) 52px", gap: 10, alignItems: "end",
  padding: 10, borderRadius: 22,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.42))",
  border: "1px solid rgba(255, 255, 255, 0.78)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 12px 24px rgba(118, 109, 150, 0.06)",
  backdropFilter: "blur(16px) saturate(140%)",
};

const chatField: React.CSSProperties = {
  padding: "14px 14px", borderRadius: 18,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.6))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
  fontSize: "0.86rem", color: "rgba(64, 56, 82, 0.6)", lineHeight: 1.52,
};

const sendBtn: React.CSSProperties = {
  width: 52, height: 52, borderRadius: 18, border: 0, cursor: "pointer",
  background: "linear-gradient(180deg, #7e87df, #646dcb)",
  color: "white",
  display: "grid", placeItems: "center",
  boxShadow: "0 12px 28px rgba(101, 111, 208, 0.2)",
};
