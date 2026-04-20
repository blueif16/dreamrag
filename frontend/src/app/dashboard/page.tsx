"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAgent } from "@copilotkitnext/react";
import { useCopilotKit } from "@copilotkitnext/react";
import { randomUUID } from "@ag-ui/client";
import { WidgetPanel, useFollowupPrompts } from "@/components/WidgetPanel";
import { WidgetToolRegistrar } from "@/components/WidgetToolRegistrar";
import { NavShell } from "@/components/NavShell";
import { consumePageTransition } from "@/components/TransitionOverlay";
import { widgetEntries } from "@/lib/widgetEntries";
import type { SpawnedWidget } from "@/lib/types";
import type { ActiveWidget } from "@/types/state";

export default function Page() {
  const [spawned, setSpawned] = useState<SpawnedWidget[]>([]);
  const expectedDumbIds = useRef<Set<string>>(new Set());
  const replaceAllGuard = useRef(false);
  const { agent } = useAgent({ agentId: "orchestrator" });
  const { copilotkit } = useCopilotKit();
  const agentRef = useRef(agent);
  const copilotRef = useRef(copilotkit);
  agentRef.current = agent;
  copilotRef.current = copilotkit;
  // Single source of truth: we've committed to a run but widgets haven't arrived yet.
  // Lazy init from sessionStorage so the very first frame is already loading —
  // no EmptyState flash between mount and the auto-send effect.
  const [awaiting, setAwaiting] = useState(() =>
    typeof window !== "undefined" && !!sessionStorage.getItem("dreamrag_dream")
  );
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const seenToolCallIds = useRef<Set<string>>(new Set());
  const seenToolResultIds = useRef<Set<string>>(new Set());

  // Auto-send dream from landing page — runs once on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("dreamrag_dream");
    if (!stored) return;
    setLastUserMessage(stored);
    console.log("[dreamrag] found dream in sessionStorage:", stored);

    // Poll until tools are registered, then send
    const poll = setInterval(() => {
      const ck = copilotRef.current;
      const ag = agentRef.current;
      const toolCount = ck.tools.length;
      console.log(`[dreamrag] polling tools… count=${toolCount}`);
      if (toolCount === 0) return;
      clearInterval(poll);
      // Only remove after we're sure we're sending
      sessionStorage.removeItem("dreamrag_dream");
      replaceAllGuard.current = false;
      console.log("[dreamrag] sending dream to agent");
      ag.addMessage({ id: randomUUID(), role: "user", content: stored });
      ck.runAgent({ agent: ag }).catch((err: unknown) => {
        console.error("[dreamrag] runAgent failed:", err);
        setAwaiting(false);
      });
    }, 150);

    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Walk every message: newly-seen tool_calls become running steps; newly-seen
  // ToolMessages flip their matching step to done. Refs dedupe across ticks so
  // streaming updates and past-run history don't spawn duplicates.
  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onMessagesChanged: ({ messages }) => {
        const additions: Step[] = [];
        const completions: string[] = [];
        for (const m of messages as any[]) {
          const tcs = m?.tool_calls ?? m?.toolCalls;
          if (Array.isArray(tcs)) {
            for (const tc of tcs) {
              const id = tc?.id;
              if (!id || seenToolCallIds.current.has(id)) continue;
              const name = tc?.function?.name ?? tc?.name ?? null;
              if (!name) continue;
              const rawArgs = tc?.function?.arguments ?? tc?.args ?? {};
              const args = typeof rawArgs === "string" ? safeParseJSON(rawArgs) : rawArgs;
              const step = stepFromCall(id, name, args);
              if (step === "wait") continue; // args still streaming — retry next tick
              seenToolCallIds.current.add(id);
              if (step) additions.push(step);
            }
          }
          const isResult = m?.role === "tool" || m?.type === "tool";
          const tcId = m?.tool_call_id ?? m?.toolCallId ?? null;
          if (isResult && tcId && !seenToolResultIds.current.has(tcId)) {
            seenToolResultIds.current.add(tcId);
            completions.push(tcId);
          }
        }
        if (additions.length === 0 && completions.length === 0) return;
        setSteps((prev) => {
          let next = additions.length ? [...prev, ...additions] : prev;
          if (completions.length) {
            const done = new Set(completions);
            next = next.map((s) => (done.has(s.id) ? { ...s, status: "done" as const } : s));
          }
          return next;
        });
      },
    });
    return unsubscribe;
  }, [agent]);

  const isRunning = agent.isRunning;

  // Authoritative end signal: onRunFinalized fires once per run (success or failure).
  // Using this instead of watching isRunning toggle avoids the mount-time false→false
  // no-op and the race where isRunning flips before widgets arrive via onStateChanged.
  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onRunFinalized: () => {
        setAwaiting(false);
      },
      onRunFailed: () => {
        setAwaiting(false);
      },
    });
    return unsubscribe;
  }, [agent]);

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onStateChanged: ({ state: s }) => {
        const activeWidgets: ActiveWidget[] = (s as any).active_widgets ?? [];
        const widgetState: Record<string, any> = (s as any).widget_state ?? {};
        const knowledge: Record<string, any[]> = (s as any).knowledge ?? {};

        const nextSpawned = activeWidgets
          .map((aw) => {
            const entry = widgetEntries.find((e) => e.config.id === aw.id);
            if (!entry) return null;
            const props =
              aw.type === "smart"
                ? { ...aw.props, ...widgetState }
                : aw.props;
            return { id: aw.id, Component: entry.Component, props };
          })
          .filter(Boolean) as SpawnedWidget[];

        const backendIds = new Set(activeWidgets.map((w) => w.id));
        const pending = expectedDumbIds.current;
        if (pending.size > 0) {
          const allConfirmed = [...pending].every((id) => backendIds.has(id));
          if (!allConfirmed) return;
          expectedDumbIds.current = new Set();
        }
        setSpawned(nextSpawned);
        if (nextSpawned.length > 0) setAwaiting(false);

        // Annotate retriever search steps with actual result counts from state.knowledge
        // so users see "5 passages" / "first entry" instead of a bare checkmark.
        setSteps((prev) => {
          let changed = false;
          const updated = prev.map((step) => {
            if (!step.namespace) return step;
            const chunks = knowledge[step.namespace];
            if (!Array.isArray(chunks)) return step;
            const detail = detailForNamespace(step.namespace, chunks.length);
            if (step.detail === detail) return step;
            changed = true;
            return { ...step, detail };
          });
          return changed ? updated : prev;
        });
      },
    });
    return unsubscribe;
  }, [agent]);

  const uniqueEntries = useMemo(() => {
    const seen = new Set<string>();
    return widgetEntries.filter((entry) => {
      if (seen.has(entry.config.tool.name)) return false;
      seen.add(entry.config.tool.name);
      return true;
    });
  }, []);

  const hasWidgets = spawned.length > 0;
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const followupPrompts = useFollowupPrompts(spawned);
  const [slideUp, setSlideUp] = useState(false);

  // Detect if we arrived via landing page transition
  useEffect(() => {
    if (consumePageTransition()) setSlideUp(true);
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() || isRunning) return;
    const text = input;
    setLastUserMessage(text);
    setSteps([]);
    setInput("");
    setAwaiting(true);
    replaceAllGuard.current = false;
    agent.addMessage({ id: randomUUID(), role: "user", content: text });
    copilotkit.runAgent({ agent });
  }, [input, isRunning, agent, copilotkit]);

  return (
    <>
      {uniqueEntries
        .filter((e) => e.config.agent === null)
        .map((entry) => (
          <WidgetToolRegistrar
            key={entry.config.id}
            entry={entry}
            setSpawned={setSpawned}
            replaceAllGuard={replaceAllGuard}
            onOptimisticRender={(w) => {
              expectedDumbIds.current.add(w.id);
            }}
          />
        ))}

      <div style={shellBg} className={slideUp ? "page-enter" : undefined}>
        {/* Ambient glow layers */}
        <div style={glowTop} />
        <div style={glowBottom} />

        {/* Shared nav */}
        <NavShell />

        {/* Scrollable content area — page label + widget grid scroll inside
            this container so the input pill stays fixed and the page height
            never changes. */}
        <div style={scrollAreaStyle}>
          {/* Page label */}
          <section style={pageLabelStyle}>
            <small style={pageLabelSmallStyle}>Dashboard</small>
            <h1 style={pageLabelH1Style}>The dream is open now.</h1>
          </section>

          {/* Widget grid or loading skeleton */}
          <div style={gridWrapStyle}>
            {lastUserMessage && (hasWidgets || awaiting) && (
              <div style={userQuestionStyle}>
                <span style={userQuestionLabelStyle}>You asked</span>
                <span style={userQuestionTextStyle}>{lastUserMessage}</span>
              </div>
            )}
            {(awaiting || isRunning) && steps.length > 0 && <Checklist steps={steps} />}
            {awaiting && steps.length === 0 && <StatusStrip />}
            {hasWidgets ? (
              <WidgetPanel spawned={spawned} />
            ) : awaiting ? (
              <SkeletonCards />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        {/* Input-focus backdrop — dims canvas, only input area stays above */}
        {inputFocused && (
          <div
            style={inputBackdropStyle}
            onClick={() => setInputFocused(false)}
          />
        )}

        {/* Floating chat pill + prompt tags */}
        <div style={{ ...chatPillWrap, zIndex: inputFocused ? 200 : 50 }} className={slideUp ? "page-enter" : undefined}>
          {/* Prompt tags — drawer slides up only when input is focused */}
          {followupPrompts.length > 0 && (
            <div style={{
              ...promptTagsWrap,
              opacity: inputFocused ? 1 : 0,
              transform: inputFocused ? "translateY(0)" : "translateY(12px)",
              pointerEvents: inputFocused ? "auto" : "none",
              transition: "opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
              {followupPrompts.map((p, i) => (
                <button
                  key={`${i}:${p}`}
                  type="button"
                  style={promptTagStyle}
                  onClick={() => {
                    setInput(p);
                    setInputFocused(false);
                    setLastUserMessage(p);
                    setSteps([]);
                    setAwaiting(true);
                    // Auto-send the prompt
                    replaceAllGuard.current = false;
                    agent.addMessage({ id: randomUUID(), role: "user", content: p });
                    copilotkit.runAgent({ agent });
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div style={chatPillStyle}>
            <input
              style={chatInputStyle}
              disabled={isRunning}
              onFocus={() => setInputFocused(true)}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  setInputFocused(false);
                  handleSend();
                }
              }}
              placeholder="Ask about your dreams..."
              value={input}
            />

            {isRunning ? (
              <button
                style={chatBtnStopStyle}
                onClick={() => agent.abortRun()}
                type="button"
                title="Stop"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#5B6EAF">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                style={{
                  ...chatBtnSendStyle,
                  opacity: input.trim() ? 1 : 0.35,
                  cursor: input.trim() ? "pointer" : "default",
                }}
                disabled={!input.trim()}
                onClick={() => { setInputFocused(false); handleSend(); }}
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" />
                  <path d="M5 12l7-7 7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Dev state viewer */}
        {process.env.NODE_ENV === "development" && (
          <details className="fixed bottom-20 right-4 z-50 max-h-96 max-w-sm overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-300 shadow-lg">
            <summary className="cursor-pointer font-mono text-gray-400">Agent State</summary>
            <pre className="mt-2 font-mono">
              {agent.state ? JSON.stringify(agent.state, null, 2) : "No state"}
            </pre>
          </details>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading cards — shimmer animation while agent processes dream
// ---------------------------------------------------------------------------

function SkeletonCards() {
  return (
    <div style={skeletonGridStyle}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...skeletonCardStyle, animationDelay: `${i * 0.15}s`, gridColumn: "span 2" }}>
          <div style={skeletonShimmer}>
            <div style={{ ...skeletonLine, width: "40%" }} />
            <div style={{ ...skeletonLine, width: "90%", height: 12 }} />
            <div style={{ ...skeletonLine, width: "75%", height: 12 }} />
            <div style={{ ...skeletonLine, width: "60%", height: 12 }} />
            <div style={{ ...skeletonCircle }} />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }
        @keyframes skeleton-card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status strip — live indicator during agent runs, driven by tool calls
// ---------------------------------------------------------------------------

type Step = {
  id: string;
  label: string;
  status: "running" | "done";
  namespace?: "dream_knowledge" | "community_dreams" | "user_default_dreams";
  detail?: string;
};

const SPAWN_LABELS: Record<string, string> = {
  show_current_dream: "Interpreting your dream",
  show_community_mirror: "Gathering similar dreams",
  show_dream_atmosphere: "Mapping the symbolic constellation",
  show_echoes_card: "Finding literary echoes",
  show_followup_chat: "Composing follow-up threads",
  show_emotion_split: "Weighing the emotional spectrum",
  show_emotional_climate: "Reading the emotional climate",
  show_heatmap_calendar: "Charting dream frequency",
  show_interpretation_synthesis: "Synthesizing interpretations",
  show_recurrence_card: "Checking for recurrent patterns",
  show_dream_streak: "Tracking your dream streak",
  show_textbook_card: "Pulling theory passages",
  show_top_symbol: "Surfacing a central symbol",
  show_stat_card: "Computing statistics",
  show_symbol_cooccurrence_network: "Tracing symbol co-occurrences",
};

function safeParseJSON(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}

function stepFromCall(id: string, name: string, args: any): Step | "wait" | null {
  if (name === "search_dreams") {
    const ns = args?.namespace as Step["namespace"] | undefined;
    if (!ns) return "wait"; // namespace may still be streaming
    return {
      id,
      status: "running",
      namespace: ns,
      label:
        ns === "dream_knowledge" ? "Consulting dream theory" :
        ns === "community_dreams" ? "Searching similar dreams" :
        ns === "user_default_dreams" ? "Reviewing your dream archive" :
        "Searching dream corpus",
    };
  }
  if (name === "record_dream") return { id, label: "Recording this dream to your archive", status: "running" };
  if (name === "get_symbol_graph") return { id, label: "Tracing symbol connections", status: "running" };
  if (name === "dispatch_to_spawner") return null;
  if (name === "clear_canvas") return null;
  if (name === "show_text_response") return null;
  const label = SPAWN_LABELS[name];
  if (!label) return null;
  return { id, label, status: "running" };
}

function detailForNamespace(ns: NonNullable<Step["namespace"]>, count: number): string {
  if (count === 0) {
    return ns === "user_default_dreams" ? "first entry" : "no matches";
  }
  if (ns === "dream_knowledge") return `${count} passages`;
  if (ns === "community_dreams") return `${count} matches`;
  return `${count} past entries`;
}

function Checklist({ steps }: { steps: Step[] }) {
  return (
    <div style={checklistStyle}>
      {steps.map((s) => (
        <div key={s.id} style={checklistItemStyle}>
          {s.status === "done" ? (
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
              <path d="M2.5 6.5l2.2 2.2L9.5 3.5" stroke="#7e87df" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          ) : (
            <span style={statusDotStyle} />
          )}
          <span style={statusLabelStyle}>{s.label}</span>
          {s.detail && <span style={checklistDetailStyle}>{s.detail}</span>}
        </div>
      ))}
      <style>{`
        @keyframes status-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.88); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes checklist-item-in {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function StatusStrip() {
  return (
    <div style={statusStripStyle}>
      <span style={statusDotStyle} />
      <span style={statusLabelStyle}>Reflecting on your dream…</span>
      <style>{`
        @keyframes status-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.88); }
          50% { opacity: 1; transform: scale(1.18); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — when no dream has been submitted yet
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div style={emptyStateStyle}>
      <div style={emptyIconStyle}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="rgba(126, 135, 223, 0.25)" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M24 16v16M16 24h16" stroke="rgba(126, 135, 223, 0.35)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p style={emptyTitleStyle}>No dreams analyzed yet</p>
      <p style={emptySubStyle}>
        Type a dream below to begin your analysis
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles — glassmorphic theme matching theme.css
// ---------------------------------------------------------------------------

const shellBg: React.CSSProperties = {
  position: "relative",
  height: "100dvh",
  width: "100%",
  fontFamily: '"Manrope", sans-serif',
  color: "#403852",
  background: `
    radial-gradient(circle at 12% 18%, rgba(214, 241, 231, 0.9), transparent 24%),
    radial-gradient(circle at 84% 10%, rgba(227, 220, 255, 0.92), transparent 30%),
    radial-gradient(circle at 82% 82%, rgba(250, 223, 232, 0.82), transparent 24%),
    radial-gradient(circle at 28% 74%, rgba(203, 224, 255, 0.7), transparent 22%),
    linear-gradient(160deg, #f8f4ee 0%, #f2edf7 46%, #fbf7f0 100%)
  `,
  overflow: "hidden",
};

const scrollAreaStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  height: "100%",
  overflowY: "auto",
  overflowX: "hidden",
};

const glowTop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  background: `
    radial-gradient(circle at 50% 0%, rgba(255,255,255,0.5), transparent 36%),
    linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.02))
  `,
};

const glowBottom: React.CSSProperties = {
  position: "fixed",
  right: "-8vw",
  bottom: "-12vw",
  width: "42vw",
  height: "42vw",
  zIndex: 0,
  pointerEvents: "none",
  borderRadius: 999,
  background: "radial-gradient(circle, rgba(255,255,255,0.18), rgba(216,207,255,0.06) 54%, transparent 72%)",
  filter: "blur(22px)",
};

const pageLabelStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 1500,
  width: "min(calc(100% - 34px), 1500px)",
  margin: "30px auto 24px",
  paddingLeft: 80,
  paddingRight: 24,
};

const pageLabelSmallStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 10,
  fontSize: "0.74rem",
  fontWeight: 800,
  color: "#89829c",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
};

const pageLabelH1Style: React.CSSProperties = {
  margin: 0,
  fontFamily: '"Cormorant Garamond", serif',
  fontWeight: 600,
  fontSize: "clamp(2.9rem, 4vw, 5.1rem)",
  lineHeight: 0.94,
  letterSpacing: "-0.03em",
  color: "#403852",
};

const gridWrapStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 1500,
  width: "min(calc(100% - 34px), 1500px)",
  margin: "0 auto",
  paddingLeft: 80,
  paddingRight: 24,
  paddingBottom: 120,
};

const userQuestionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 12,
  marginBottom: 20,
  paddingBottom: 16,
  borderBottom: "1px solid rgba(107,95,165,0.08)",
};

const userQuestionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#9b8fb8",
  flexShrink: 0,
};

const userQuestionTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 18,
  fontWeight: 500,
  color: "#2d2640",
  lineHeight: 1.3,
};

const chatPillWrap: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: 0,
  right: 0,
  marginInline: "auto",
  zIndex: 50,
  width: "100%",
  maxWidth: 680,
  padding: "0 16px",
};

const chatPillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 10px 10px 20px",
  borderRadius: 24,
  background: "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.5))",
  border: "1px solid rgba(255,255,255,0.82)",
  backdropFilter: "blur(22px) saturate(145%)",
  boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.8),
    0 18px 44px rgba(96,82,124,0.12)
  `,
};

const chatInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 0",
  border: "none",
  background: "transparent",
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.9rem",
  fontWeight: 400,
  color: "#403852",
  outline: "none",
  letterSpacing: "0.01em",
};

const chatBtnStopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 42,
  height: 42,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.82)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.58))",
  backdropFilter: "blur(14px) saturate(140%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78), 0 10px 22px rgba(118,109,150,0.06)",
  cursor: "pointer",
  flexShrink: 0,
};

const chatBtnSendStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 42,
  height: 42,
  borderRadius: 16,
  border: "none",
  background: "linear-gradient(180deg, #7e87df, #646dcb)",
  boxShadow: "0 16px 36px rgba(101,111,208,0.24)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  flexShrink: 0,
};

// ---------------------------------------------------------------------------
// Skeleton styles
// ---------------------------------------------------------------------------

const skeletonGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 20,
  padding: "8px 0",
};

const skeletonCardStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 28,
  minHeight: 200,
  background: "linear-gradient(180deg, rgba(255,255,255,0.52), rgba(255,255,255,0.32))",
  border: "1px solid rgba(255,255,255,0.72)",
  backdropFilter: "blur(18px) saturate(130%)",
  boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.7),
    0 12px 32px rgba(96,82,124,0.06)
  `,
  animation: "skeleton-card-in 0.5s ease both",
};

const skeletonShimmer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  animation: "skeleton-pulse 1.8s ease-in-out infinite",
};

const skeletonLine: React.CSSProperties = {
  height: 10,
  borderRadius: 6,
  background: "linear-gradient(90deg, rgba(126,135,223,0.1), rgba(126,135,223,0.18), rgba(126,135,223,0.1))",
};

const skeletonCircle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  marginTop: 8,
  background: "linear-gradient(90deg, rgba(126,135,223,0.08), rgba(126,135,223,0.15), rgba(126,135,223,0.08))",
};

// ---------------------------------------------------------------------------
// Empty state styles
// ---------------------------------------------------------------------------

const statusStripStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  margin: "4px 0 24px",
  paddingLeft: 2,
};

const statusDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#7e87df",
  boxShadow: "0 0 14px rgba(126,135,223,0.55)",
  animation: "status-pulse 1.4s ease-in-out infinite",
  flexShrink: 0,
};

const statusLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#7e87df",
  fontFamily: "'Manrope', sans-serif",
};

const checklistStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  margin: "4px 0 24px",
  paddingLeft: 2,
};

const checklistItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  animation: "checklist-item-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) both",
};

const checklistDetailStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "none",
  color: "rgba(126,135,223,0.55)",
  fontFamily: "'Manrope', sans-serif",
};

const emptyStateStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 340,
  gap: 12,
};

const emptyIconStyle: React.CSSProperties = {
  marginBottom: 8,
  opacity: 0.7,
};

const emptyTitleStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "1.6rem",
  fontWeight: 500,
  color: "#403852",
  margin: 0,
};

const emptySubStyle: React.CSSProperties = {
  fontSize: "0.82rem",
  fontWeight: 400,
  color: "rgba(64, 56, 82, 0.5)",
  letterSpacing: "0.04em",
  margin: 0,
};

// ---------------------------------------------------------------------------
// Input-focus backdrop + prompt tags
// ---------------------------------------------------------------------------

const inputBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 150,
  background: "rgba(26, 26, 46, 0.22)",
  backdropFilter: "blur(3px)",
  WebkitBackdropFilter: "blur(3px)",
  transition: "opacity 0.25s ease",
};

const promptTagsWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "center",
  marginBottom: 12,
};

const promptTagStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "#403852",
  background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.6))",
  backdropFilter: "blur(16px) saturate(140%)",
  WebkitBackdropFilter: "blur(16px) saturate(140%)",
  border: "1px solid rgba(255,255,255,0.78)",
  borderRadius: 99,
  padding: "10px 20px",
  cursor: "pointer",
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 14px rgba(96,82,124,0.1)",
  fontFamily: "'Manrope', sans-serif",
  letterSpacing: "0.01em",
  lineHeight: 1.3,
};
