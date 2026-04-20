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
  user_id: "demo_dreamer",
  emotion_distribution: [],
  recurrence: [],
  current_streak: 0,
  last7: [false, false, false, false, false, false, false],
  heatmap_data: [],
  heatmap_month: "",
  total_dreams: 0,
};

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatUsername(user_id: string): string {
  return user_id
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/* ─────────────────────────────────────────────────────────────────────────────
   Data-driven inferences — all derived from actual user_profiles fields
   ───────────────────────────────────────────────────────────────────────────── */

const EMOTION_COLOR: Record<string, string> = {
  anxiety: "#7b82d8", joy: "#f2b084", sadness: "#7a8296", anger: "#c87a7a",
  fear: "#6a7080", confusion: "#a89ab8", peace: "#9bc0a4", excitement: "#e5b97a",
  love: "#e89ba8", loneliness: "#8b94a8", guilt: "#b098b8", wonder: "#e8c47d",
};
const BRIGHT = new Set(["joy", "peace", "excitement", "love", "wonder"]);
const SHADOW = new Set(["anxiety", "sadness", "anger", "fear", "loneliness", "guilt"]);

function colorFor(label: string): string {
  const key = label.toLowerCase();
  for (const k of Object.keys(EMOTION_COLOR)) {
    if (key.includes(k)) return EMOTION_COLOR[k];
  }
  return "#a8a0c4";
}

function classifyTenor(dist: Emotion[]): { label: string; bright: number; shadow: number } {
  let bright = 0, shadow = 0;
  for (const e of dist) {
    const k = e.label.toLowerCase();
    if ([...BRIGHT].some(b => k.includes(b))) bright += e.pct;
    else if ([...SHADOW].some(s => k.includes(s))) shadow += e.pct;
  }
  const diff = bright - shadow;
  const label = diff >= 12 ? "Bright" : diff <= -12 ? "Shadow-leaning" : "Balanced";
  return { label, bright: Math.round(bright), shadow: Math.round(shadow) };
}

function peakWeekday(grid: number[][]): string | null {
  if (grid.length < 7) return null;
  const sums = grid.map(r => r.reduce((a, b) => a + b, 0));
  const max = Math.max(...sums);
  if (max === 0) return null;
  return WEEKDAY_NAMES[sums.indexOf(max)];
}

function dreamsPerWeek(grid: number[][]): number {
  if (!grid.length || !grid[0].length) return 0;
  const total = grid.flat().reduce((a, b) => a + b, 0);
  return Math.round((total / grid[0].length) * 10) / 10;
}

function monthTotal(grid: number[][]): number {
  return grid.flat().reduce((a, b) => a + b, 0);
}

const MONTH_IDX: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

function firstWeekdayMon0(monthName: string, year: number): number {
  const m = MONTH_IDX[monthName];
  if (m === undefined) return 0;
  const js = new Date(year, m, 1).getDay(); // 0=Sun..6=Sat
  return (js + 6) % 7;                       // → 0=Mon..6=Sun
}
function daysInMonth(monthName: string, year: number): number {
  const m = MONTH_IDX[monthName];
  if (m === undefined) return 30;
  return new Date(year, m + 1, 0).getDate();
}

function reflectionText(p: Profile): string {
  const topSym = p.recurrence[0];
  const topEmo = p.emotion_distribution[0];
  if (!topSym && !topEmo) return "";
  if (p.current_streak >= 7 && topSym) {
    return `A ${p.current_streak}-day current through ${topSym.label.toLowerCase()}.`;
  }
  if (topSym && topEmo) {
    return `Your dreams return to ${topSym.label.toLowerCase()}, colored by ${topEmo.label.toLowerCase()}.`;
  }
  if (topSym) return `Your dreams return to ${topSym.label.toLowerCase()}.`;
  return `Your dreams carry ${topEmo!.label.toLowerCase()}.`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const [p, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user-profile?user_id=demo_dreamer")
      .then((r) => r.json())
      .then((d: Profile) => { setProfile(d); setLoading(false); })
      .catch(() => { setProfile(EMPTY); setLoading(false); });
  }, []);

  const top = p.recurrence[0];
  const coSymbols = p.recurrence.slice(1, 3);
  const threadSymbols = p.recurrence.slice(3, 5);
  const tenor = classifyTenor(p.emotion_distribution);
  const peak = peakWeekday(p.heatmap_data);
  const perWeek = dreamsPerWeek(p.heatmap_data);
  const mTotal = monthTotal(p.heatmap_data);
  const reflection = reflectionText(p);
  const hasData = p.total_dreams > 0;

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
        ) : !hasData ? (
          <div style={{ ...glass, ...heroGlass, padding: 48, textAlign: "center" }}>
            <div style={inner}>
              <h2 style={{ ...heroName, fontSize: "2.4rem" }}>No dreams recorded yet.</h2>
              <p style={muted}>
                Start in <a href="/dashboard" style={link}>Dashboard</a> — patterns build as you record.
              </p>
            </div>
          </div>
        ) : (
          <div style={grid}>
            {/* ── Hero (5 col) — emotion-colored signature + live summaries ── */}
            <article style={{ ...glass, ...heroGlass, gridColumn: "span 5", minHeight: 340 }}>
              <div style={inner}>
                <div style={{ display: "grid", gap: 6 }}>
                  <h2 style={heroName}>{formatUsername(p.user_id)}</h2>
                  <small style={heroSubtle}>
                    {p.total_dreams} {p.total_dreams === 1 ? "dream" : "dreams"} recorded
                  </small>
                </div>
                <div style={twoCol}>
                  <SummaryCard
                    label="dream streak"
                    metric={`${p.current_streak} ${p.current_streak === 1 ? "day" : "days"}`}
                    note={p.current_streak > 7 ? "Recorded nearly every day." : p.current_streak > 0 ? "Keep the streak alive." : "Record today to begin."}
                  />
                  <SummaryCard
                    label="favorite motif"
                    metric={top?.label ?? "—"}
                    metricSmall
                    note={coSymbols.length ? `Most often with ${coSymbols.map(s => s.label.toLowerCase()).join(" and ")}.` : "Record more to find patterns."}
                  />
                </div>
              </div>
            </article>

            {/* ── Emotional Climate (7 col) ── */}
            <article style={{ ...glass, gridColumn: "span 7" }}>
              <div style={inner}>
                <Eyebrow>Emotional Climate</Eyebrow>
                {p.emotion_distribution.length === 0 ? (
                  <p style={muted}>No emotion tags yet.</p>
                ) : (
                  <div style={barList}>
                    {p.emotion_distribution.map(e => (
                      <div key={e.label} style={barRow}>
                        <div style={barLabelRow}><span>{e.label}</span><span style={{ opacity: 0.6 }}>{e.pct}%</span></div>
                        <div style={barTrack}>
                          <div style={{ ...barFill, width: `${e.pct}%`, background: `linear-gradient(90deg, ${colorFor(e.label)}cc, ${colorFor(e.label)}ee)` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>

            {/* ── Top Symbol (4 col) ── */}
            <article style={{ ...glass, gridColumn: "span 4", minHeight: 200 }}>
              <div style={inner}>
                <Eyebrow>Top Symbol</Eyebrow>
                <div style={metric}>{top?.label ?? "—"}</div>
                <p style={muted}>{top?.note ?? "No symbol tags yet."}</p>
                {coSymbols.length > 0 && (
                  <div style={pillRow}>
                    {coSymbols.map(s => <span key={s.label} style={tag}>{s.label.toLowerCase()} {s.value}</span>)}
                  </div>
                )}
              </div>
            </article>

            {/* ── Rhythm (4 col) — dreams/week + peak weekday + last7 dots ── */}
            <article style={{ ...glass, gridColumn: "span 4", minHeight: 200 }}>
              <div style={inner}>
                <Eyebrow>Rhythm</Eyebrow>
                <div style={metric}>{perWeek > 0 ? `${perWeek}/wk` : "—"}</div>
                <p style={muted}>{peak ? `Peaks on ${peak}.` : "Record more to find a rhythm."}</p>
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

            {/* ── Emotional Tenor (4 col) — bright/shadow ratio ── */}
            <article style={{ ...glass, ...accentGlass, gridColumn: "span 4", minHeight: 200 }}>
              <div style={inner}>
                <Eyebrow>Emotional Tenor</Eyebrow>
                <div style={{ ...metric, color: tenor.label === "Bright" ? "#b8894a" : tenor.label === "Shadow-leaning" ? "#5761bf" : "#7a6e9a" }}>
                  {tenor.label}
                </div>
                <div style={tenorBar}>
                  <div style={{ ...tenorSeg, width: `${tenor.shadow}%`, background: "linear-gradient(90deg, #6a7080, #7b82d8)" }} />
                  <div style={{ ...tenorSeg, width: `${tenor.bright}%`, background: "linear-gradient(90deg, #e8c47d, #f2b084)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "rgba(64,56,82,0.55)", letterSpacing: "0.04em" }}>
                  <span>{tenor.shadow}% shadow</span>
                  <span>{tenor.bright}% bright</span>
                </div>
              </div>
            </article>

            {/* ── Dream Frequency heatmap (12 col) ── */}
            <article style={{ ...glass, gridColumn: "span 12" }}>
              <div style={inner}>
                <Eyebrow>Dream Frequency</Eyebrow>
                <DreamHeatmap data={p.heatmap_data} month={p.heatmap_month} total={mTotal} />
              </div>
            </article>

            {/* ── Recurring Threads (8 col) — from recurrence[3..5] ── */}
            <article style={{ ...glass, gridColumn: "span 8" }}>
              <div style={inner}>
                <Eyebrow>Recurring Threads</Eyebrow>
                {threadSymbols.length > 0 ? (
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: threadSymbols.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr" }}>
                    {threadSymbols.map(s => (
                      <NoteCard key={s.label} title={`${s.label} · ${s.value}`} body={s.note} />
                    ))}
                  </div>
                ) : (
                  <p style={muted}>Deeper patterns emerge after more dreams are recorded.</p>
                )}
              </div>
            </article>

            {/* ── Tonight's note (4 col) — templated reflection ── */}
            <article style={{ ...glass, ...accentGlass, gridColumn: "span 4" }}>
              <div style={inner}>
                <Eyebrow>Tonight&rsquo;s note</Eyebrow>
                <h2 style={reflTitle}>{reflection || "—"}</h2>
                <p style={reflNote}>
                  Return to a single dream in <a href="/archive" style={link}>Archive</a> or <a href="/dashboard" style={link}>Dashboard</a>.
                </p>
              </div>
            </article>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Heatmap — real calendar grid: weekday rows × week columns, with date labels
   ───────────────────────────────────────────────────────────────────────────── */

function DreamHeatmap({ data, month, total }: { data: number[][]; month: string; total: number }) {
  const year = new Date().getFullYear();
  const weeks = data[0]?.length ?? 0;
  const firstWd = firstWeekdayMon0(month, year);
  const dim = daysInMonth(month, year);

  const dayAt = (wd: number, week: number): number | null => {
    const n = week * 7 + wd - firstWd + 1;
    return n < 1 || n > dim ? null : n;
  };

  if (!data.length || weeks === 0) {
    return <p style={muted}>No dreams recorded this month.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={heatHeader}>
        <span style={heatMonthLbl}>{month} {year}</span>
        <span style={heatTotalLbl}>{total} {total === 1 ? "dream" : "dreams"} this month</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `32px repeat(${weeks}, minmax(0, 1fr))`,
          gridTemplateRows: "repeat(7, minmax(36px, 1fr))",
          gap: 6,
        }}
      >
        {DAYS.map((d, i) => (
          <span key={`l${i}`} style={{ ...heatDayLbl, gridRow: i + 1, gridColumn: 1 }}>{d}</span>
        ))}
        {data.flatMap((row, wd) =>
          row.map((lvl, week) => {
            const day = dayAt(wd, week);
            const active = day !== null;
            return (
              <span
                key={`${wd}-${week}`}
                title={active ? `${month} ${day} · ${lvl}${lvl >= 4 ? "+" : ""} dream${lvl === 1 ? "" : "s"}` : ""}
                style={{
                  gridRow: wd + 1,
                  gridColumn: week + 2,
                  borderRadius: 8,
                  background: active ? (HEAT[lvl] ?? HEAT[0]) : "rgba(255, 255, 255, 0.18)",
                  border: active ? "1px solid rgba(255, 255, 255, 0.72)" : "1px dashed rgba(255, 255, 255, 0.3)",
                  position: "relative",
                  padding: "4px 6px",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  color: active ? "rgba(64, 56, 82, 0.5)" : "transparent",
                  lineHeight: 1,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  cursor: active ? "default" : "default",
                  boxShadow: active && lvl > 0 ? "inset 0 1px 0 rgba(255,255,255,0.6)" : "none",
                }}
              >
                {active ? day : ""}
              </span>
            );
          })
        )}
      </div>
      <div style={legendRow}>
        <span style={legendLabel}>Dreams / day</span>
        <div style={legendScale}>
          {[0, 1, 2, 3, 4].map(l => (
            <div key={l} style={legendItem}>
              <span style={{ ...legendCell, background: HEAT[l] }} />
              <span style={legendCountLabel}>{l === 4 ? "4+" : l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Tiny components
   ───────────────────────────────────────────────────────────────────────────── */

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
  4: "rgba(234, 199, 137, 0.88)",
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
const heroName: React.CSSProperties = { margin: 0, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: "clamp(2.8rem, 3.4vw, 4rem)", lineHeight: 0.94, letterSpacing: "-0.03em", color: "#403852" };

const heroSubtle: React.CSSProperties = { fontSize: "0.9rem", color: "rgba(64, 56, 82, 0.55)", letterSpacing: "0.02em" };

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

/* ── Emotional Tenor bar ── */
const tenorBar: React.CSSProperties = {
  display: "flex", height: 12, borderRadius: 999, overflow: "hidden",
  background: "rgba(114, 108, 134, 0.08)",
  marginTop: 4,
};
const tenorSeg: React.CSSProperties = { height: "100%", transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" };

/* ── Heatmap ── */
const heatHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 };
const heatMonthLbl: React.CSSProperties = { fontFamily: '"Cormorant Garamond", serif', fontSize: "1.7rem", lineHeight: 1, color: "#403852", letterSpacing: "-0.02em" };
const heatTotalLbl: React.CSSProperties = { fontSize: "0.82rem", color: "rgba(64, 56, 82, 0.55)", letterSpacing: "0.04em" };
const heatDayLbl: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, color: "rgba(64, 56, 82, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" };
const legendRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 6, paddingTop: 10, borderTop: "1px solid rgba(255, 255, 255, 0.42)" };
const legendLabel: React.CSSProperties = { fontSize: "0.66rem", fontWeight: 700, color: "rgba(64, 56, 82, 0.5)", letterSpacing: "0.1em", textTransform: "uppercase" };
const legendScale: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const legendItem: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 };
const legendCell: React.CSSProperties = { width: 14, height: 14, borderRadius: 4, border: "1px solid rgba(255, 255, 255, 0.72)" };
const legendCountLabel: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, color: "rgba(64, 56, 82, 0.55)", letterSpacing: "0.02em" };

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
const reflTitle: React.CSSProperties = { margin: 0, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: "1.9rem", lineHeight: 1.08, letterSpacing: "-0.02em", color: "#403852" };
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
