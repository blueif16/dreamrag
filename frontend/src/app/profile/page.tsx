"use client";

import { useState, useEffect } from "react";
import { NavShell } from "@/components/NavShell";

/* ── Types matching /api/user-profile ── */
interface Emotion { label: string; pct: number }
interface Recurrence { label: string; value: string; note: string }
interface Profile {
  user_id: string;
  emotion_distribution: Emotion[];
  recurrence: Recurrence[];
  current_streak: number;
  last7: boolean[];
  heatmap_data: number[][];
  heatmap_month: string;
  total_dreams: number;
}

const EMPTY: Profile = {
  user_id: "default",
  emotion_distribution: [],
  recurrence: [],
  current_streak: 0,
  last7: [false, false, false, false, false, false, false],
  heatmap_data: [],
  heatmap_month: "",
  total_dreams: 0,
};

const DEMO: Profile = {
  user_id: "demo",
  emotion_distribution: [
    { label: "Gentle anxiety", pct: 38 },
    { label: "Wonder", pct: 24 },
    { label: "Peace", pct: 17 },
    { label: "Urgency", pct: 12 },
  ],
  recurrence: [
    { label: "Water", value: "9×", note: "Appeared in 40% of dreams" },
    { label: "Night", value: "5×", note: "Appeared in 22% of dreams" },
    { label: "House", value: "4×", note: "Appeared in 18% of dreams" },
  ],
  current_streak: 27,
  last7: [true, true, false, true, true, true, true],
  heatmap_data: [
    [0, 1, 0, 2, 1],
    [2, 0, 3, 0, 1],
    [0, 1, 0, 2, 0],
    [1, 0, 2, 0, 3],
    [0, 2, 1, 0, 2],
    [3, 1, 0, 2, 4],
    [1, 0, 1, 4, 1],
  ],
  heatmap_month: "April",
  total_dreams: 23,
};

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function ProfilePage() {
  const [p, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user-profile?user_id=default")
      .then((r) => r.json())
      .then((d: Profile) => {
        setProfile(d.total_dreams > 0 ? d : DEMO);
        setLoading(false);
      })
      .catch(() => { setProfile(DEMO); setLoading(false); });
  }, []);

  const top = p.recurrence[0];
  const coSymbols = p.recurrence.slice(1, 3);

  return (
    <div style={root}>
      <div style={backdrop} />
      <div style={glowTop} />
      <NavShell />

      <div style={wrap}>
        <header style={hdr}>
          <small style={eyebrowLabel}>Profile</small>
          <h1 style={pageTitle}>Your dreaming self, in patterns.</h1>
        </header>

        {loading ? (
          <div style={loadWrap}>
            <div style={loadOrb}>
              <div style={loadRingOuter} />
              <div style={loadRingInner} />
              <div style={loadDot} />
            </div>
            <p style={loadLabel}>Loading dream profile</p>
            <style>{`
              @keyframes loaderSpin { to { transform: rotate(360deg); } }
              @keyframes loaderSpinReverse { to { transform: rotate(-360deg); } }
              @keyframes loaderPulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.6); opacity: 1; } }
              @keyframes loaderTextFade { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.7; } }
            `}</style>
          </div>
        ) : (
          <div style={grid}>
            {/* ── Hero (5 col) ── */}
            <article style={{ ...glass, ...heroGlass, gridColumn: "span 5", minHeight: 340 }}>
              <div style={inner}>
                <div style={row18}>
                  <div style={avatar} />
                  <h2 style={heroName}>Dreamer</h2>
                </div>
                <div style={twoCol}>
                  <SummaryCard label="dream streak" metric={`${p.current_streak} days`} note={p.current_streak > 7 ? "Recorded nearly every day." : "Keep the streak alive."} />
                  <SummaryCard label="favorite motif" metric={top?.label ?? "—"} metricSmall note={coSymbols.length ? `Most often with ${coSymbols.map(s => s.label.toLowerCase()).join(" and ")}.` : "Record more to find patterns."} />
                </div>
              </div>
            </article>

            {/* ── Emotional Climate (7 col) ── */}
            <article style={{ ...glass, gridColumn: "span 7" }}>
              <div style={inner}>
                <Eyebrow>Emotional Climate</Eyebrow>
                <div style={barList}>
                  {p.emotion_distribution.map(e => (
                    <div key={e.label} style={barRow}>
                      <div style={barLabelRow}><span>{e.label}</span><span style={{ opacity: 0.6 }}>{e.pct}%</span></div>
                      <div style={barTrack}><div style={{ ...barFill, width: `${e.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            {/* ── Top Symbol (4 col) ── */}
            <article style={{ ...glass, gridColumn: "span 4", minHeight: 200 }}>
              <div style={inner}>
                <Eyebrow>Top Symbol</Eyebrow>
                <div style={metric}>{top?.label ?? "—"}</div>
                <p style={muted}>{top?.note ?? ""}</p>
                {coSymbols.length > 0 && (
                  <div style={pillRow}>
                    {coSymbols.map(s => <span key={s.label} style={tag}>{s.label.toLowerCase()} {s.value}</span>)}
                  </div>
                )}
              </div>
            </article>

            {/* ── Rhythm + Last 7 (4 col) ── */}
            <article style={{ ...glass, gridColumn: "span 4", minHeight: 200 }}>
              <div style={inner}>
                <Eyebrow>Rhythm</Eyebrow>
                <div style={metric}>{p.total_dreams > 0 ? "5–7 days" : "—"}</div>
                <div style={dotRow}>
                  {p.last7.map((on, i) => (
                    <div key={i} style={dotCol}>
                      <div style={{ ...dot, background: on ? "linear-gradient(180deg, #b6d5ff, #6b75d4)" : "rgba(107, 117, 212, 0.12)", boxShadow: on ? "0 0 8px rgba(107,117,212,0.35)" : "none" }} />
                      <span style={dotLabel}>{DAYS[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            {/* ── Lucidity (4 col, accent) ── */}
            <article style={{ ...glass, ...accentGlass, gridColumn: "span 4", minHeight: 200 }}>
              <div style={inner}>
                <Eyebrow>Lucidity</Eyebrow>
                <div style={{ ...metric, color: "#5761bf" }}>Low</div>
                <span style={chip}>Dream-led state</span>
              </div>
            </article>

            {/* ── Heatmap (8 col) ── */}
            <article style={{ ...glass, gridColumn: "span 8" }}>
              <div style={inner}>
                <Eyebrow>Dream Frequency{p.heatmap_month ? ` — ${p.heatmap_month}` : ""}</Eyebrow>
                <div style={heatGrid(p.heatmap_data)}>
                  {DAYS.map((d, i) => <span key={`l${i}`} style={heatDayLbl}>{d}</span>)}
                  {p.heatmap_data.length > 0
                    ? p.heatmap_data.flatMap((row, di) => row.map((lvl, wi) => <span key={`${di}-${wi}`} style={{ ...heatCell, background: HEAT[lvl] ?? HEAT[0] }} />))
                    : Array.from({ length: 35 }, (_, i) => <span key={i} style={heatCell} />)}
                </div>
                <div style={legendRow}>
                  <span style={legendLabel}>Less</span>
                  {[0, 1, 2, 3, 4].map(l => <span key={l} style={{ ...legendCell, background: HEAT[l] }} />)}
                  <span style={legendLabel}>More</span>
                </div>
              </div>
            </article>

            {/* ── Threads + Reflection (4 col) ── */}
            <article style={{ ...glass, gridColumn: "span 4" }}>
              <div style={inner}>
                <Eyebrow>Saved Threads</Eyebrow>
                <div style={{ display: "grid", gap: 10 }}>
                  <NoteCard title="Water + home" body="Usually tied to belonging and memory." />
                  <NoteCard title="Night movement" body="Often appears when uncertainty is processed quietly." />
                </div>
                <div style={divider} />
                <Eyebrow>Reflection</Eyebrow>
                <h2 style={reflTitle}>You dream in search patterns.</h2>
                <p style={reflNote}>
                  Open <a href="/archive" style={link}>Archive</a> or <a href="/dashboard" style={link}>Dashboard</a> to return to a single dream.
                </p>
              </div>
            </article>
          </div>
        )}
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

function SummaryCard({ label, metric: m, note, metricSmall }: { label: string; metric: string; note: string; metricSmall?: boolean }) {
  return (
    <div style={summaryCard}>
      <strong style={summaryLbl}>{label}</strong>
      <div style={{ ...metric, fontSize: metricSmall ? "2rem" : undefined }}>{m}</div>
      <p style={muted}>{note}</p>
    </div>
  );
}

function NoteCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={noteCard}>
      <strong style={noteTitle}>{title}</strong>
      <p style={muted}>{body}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Styles — warm frost glass on the landing gradient
   ───────────────────────────────────────────────────────────────────────────── */

const HEAT: Record<number, string> = {
  0: "rgba(255, 255, 255, 0.5)",
  1: "rgba(203, 236, 224, 0.78)",
  2: "rgba(208, 215, 255, 0.82)",
  3: "rgba(246, 208, 220, 0.84)",
  4: "rgba(234, 199, 137, 0.84)",
};

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

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 18 };

/* ── Glass — warm frost ── */
const glass: React.CSSProperties = {
  position: "relative", overflow: "hidden", borderRadius: 28,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.38))",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  backdropFilter: "blur(24px) saturate(145%)",
  boxShadow: "0 24px 60px rgba(96, 82, 124, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
};

const heroGlass: React.CSSProperties = {
  background: `
    radial-gradient(circle at 82% 18%, rgba(191, 221, 255, 0.5), transparent 28%),
    radial-gradient(circle at 16% 88%, rgba(246, 213, 222, 0.4), transparent 24%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.44))
  `,
};

const accentGlass: React.CSSProperties = {
  background: `
    radial-gradient(circle at 78% 18%, rgba(208, 218, 255, 0.6), transparent 32%),
    radial-gradient(circle at 18% 82%, rgba(237, 228, 255, 0.35), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(243, 242, 255, 0.58))
  `,
  borderColor: "rgba(255, 255, 255, 0.82)",
  boxShadow: "0 18px 42px rgba(103, 111, 183, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.85)",
};

const inner: React.CSSProperties = { position: "relative", zIndex: 1, padding: 26, height: "100%", display: "grid", gap: 16, alignContent: "start" };

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

/* ── Hero ── */
const row18: React.CSSProperties = { display: "flex", gap: 18, alignItems: "center" };

const avatar: React.CSSProperties = {
  width: 72, height: 72, borderRadius: 24, flexShrink: 0,
  background: "radial-gradient(circle at 28% 26%, rgba(255, 255, 255, 0.94), transparent 28%), linear-gradient(155deg, rgba(120, 131, 225, 0.9), rgba(238, 194, 210, 0.84))",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.76), 0 14px 30px rgba(113, 123, 214, 0.18)",
};

const heroName: React.CSSProperties = { margin: 0, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: "2.8rem", lineHeight: 0.94, letterSpacing: "-0.03em", color: "#403852" };

const twoCol: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 };

const summaryCard: React.CSSProperties = {
  padding: 17, borderRadius: 22,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.5))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 10px 22px rgba(118, 109, 150, 0.06)",
  backdropFilter: "blur(16px) saturate(140%)",
  display: "grid", gap: 8,
};

const summaryLbl: React.CSSProperties = { display: "block", fontSize: "0.73rem", fontWeight: 800, color: "rgba(64, 56, 82, 0.45)", letterSpacing: "0.12em", textTransform: "uppercase" as const };

/* ── Metric ── */
const metric: React.CSSProperties = { fontFamily: '"Cormorant Garamond", serif', fontSize: "clamp(2.2rem, 2.5vw, 3.1rem)", lineHeight: 0.9, color: "#403852" };

const muted: React.CSSProperties = { margin: 0, fontSize: "0.86rem", color: "rgba(64, 56, 82, 0.55)", lineHeight: 1.6 };

/* ── Bars ── */
const barList: React.CSSProperties = { display: "grid", gap: 14 };
const barRow: React.CSSProperties = { display: "grid", gap: 8 };
const barLabelRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, color: "rgba(64, 56, 82, 0.65)", fontSize: "0.88rem" };
const barTrack: React.CSSProperties = { height: 10, borderRadius: 999, background: "rgba(114, 108, 134, 0.08)", overflow: "hidden" };
const barFill: React.CSSProperties = { height: "100%", borderRadius: "inherit", background: "linear-gradient(90deg, rgba(122, 133, 221, 0.82), rgba(164, 206, 255, 0.96))", transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" };

/* ── Pills / Tags ── */
const pillRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

const tag: React.CSSProperties = {
  display: "inline-flex", padding: "6px 12px", borderRadius: 999,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.6))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.84), 0 8px 16px rgba(118, 109, 150, 0.05)",
  fontSize: "0.74rem", fontWeight: 600, color: "rgba(64, 56, 82, 0.65)", letterSpacing: "0.04em",
};

/* ── Last-7 dots ── */
const dotRow: React.CSSProperties = { display: "flex", gap: 10, marginTop: 4 };
const dotCol: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 5 };
const dot: React.CSSProperties = { width: 10, height: 10, borderRadius: 999, transition: "all 0.3s ease" };
const dotLabel: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, color: "rgba(64, 56, 82, 0.35)", letterSpacing: "0.06em" };

/* ── Chip ── */
const chip: React.CSSProperties = {
  display: "inline-flex", alignSelf: "start", padding: "8px 12px", borderRadius: 999,
  background: "linear-gradient(180deg, rgba(229, 235, 255, 0.92), rgba(245, 247, 255, 0.74))",
  border: "1px solid rgba(255, 255, 255, 0.84)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 8px 16px rgba(104, 114, 190, 0.08)",
  fontSize: "0.74rem", fontWeight: 800, letterSpacing: "0.05em",
  color: "rgba(87, 97, 191, 0.85)",
};

/* ── Heatmap ── */
function heatGrid(data: number[][]): React.CSSProperties {
  const weeks = data.length > 0 ? data[0].length : 5;
  return { display: "grid", gridTemplateColumns: `20px repeat(${weeks}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, minmax(0, 1fr))", gap: 6, marginTop: 8, maxWidth: 400 };
}
const heatDayLbl: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, color: "rgba(64, 56, 82, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" };
const heatCell: React.CSSProperties = { aspectRatio: "1", borderRadius: 8, background: HEAT[0], border: "1px solid rgba(255, 255, 255, 0.72)" };
const legendRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, marginTop: 10 };
const legendLabel: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 600, color: "rgba(64, 56, 82, 0.35)", letterSpacing: "0.04em", marginRight: 2 };
const legendCell: React.CSSProperties = { width: 12, height: 12, borderRadius: 4, border: "1px solid rgba(255, 255, 255, 0.72)" };

/* ── Notes ── */
const noteCard: React.CSSProperties = {
  padding: 16, borderRadius: 18,
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.5))",
  border: "1px solid rgba(255, 255, 255, 0.82)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 10px 22px rgba(118, 109, 150, 0.06)",
  display: "grid", gap: 6,
};
const noteTitle: React.CSSProperties = { display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#403852", letterSpacing: "0.02em" };

/* ── Reflection ── */
const divider: React.CSSProperties = { height: 1, background: "rgba(103, 91, 132, 0.08)", borderRadius: 1 };
const reflTitle: React.CSSProperties = { margin: 0, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: "2.2rem", lineHeight: 0.94, letterSpacing: "-0.03em", color: "#403852" };
const reflNote: React.CSSProperties = { margin: 0, fontSize: "0.85rem", color: "rgba(64, 56, 82, 0.55)", lineHeight: 1.64 };
const link: React.CSSProperties = { color: "#5761bf", fontWeight: 800, textDecoration: "none" };

/* ── Loading ── */
const loadWrap: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, minHeight: 400 };

const loadOrb: React.CSSProperties = {
  position: "relative", width: 72, height: 72,
  display: "flex", alignItems: "center", justifyContent: "center",
};

const loadRingOuter: React.CSSProperties = {
  position: "absolute", inset: 0, borderRadius: "50%",
  border: "2px solid transparent",
  borderTopColor: "rgba(107, 117, 212, 0.6)",
  borderRightColor: "rgba(182, 213, 255, 0.3)",
  animation: "loaderSpin 1.6s linear infinite",
};

const loadRingInner: React.CSSProperties = {
  position: "absolute", inset: 10, borderRadius: "50%",
  border: "1.5px solid transparent",
  borderBottomColor: "rgba(182, 213, 255, 0.5)",
  borderLeftColor: "rgba(126, 135, 223, 0.2)",
  animation: "loaderSpinReverse 2.4s linear infinite",
};

const loadDot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: "50%",
  background: "radial-gradient(circle, rgba(182, 213, 255, 1), rgba(107, 117, 212, 0.5))",
  boxShadow: "0 0 12px rgba(107, 117, 212, 0.4)",
  animation: "loaderPulse 2s ease-in-out infinite",
};

const loadLabel: React.CSSProperties = {
  margin: 0,
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "1.05rem", fontWeight: 400, fontStyle: "italic",
  letterSpacing: "0.04em",
  color: "rgba(64, 56, 82, 0.45)",
  animation: "loaderTextFade 2.5s ease-in-out infinite",
};
