"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAgent } from "@copilotkitnext/react";
import { useCopilotKit } from "@copilotkitnext/react";
import { randomUUID } from "@ag-ui/client";
import { WidgetPanel } from "@/components/WidgetPanel";
import { WidgetToolRegistrar } from "@/components/WidgetToolRegistrar";
import { NavShell } from "@/components/NavShell";
import { widgetEntries } from "@/lib/widgetEntries";
import type { SpawnedWidget } from "@/lib/types";
import type { ActiveWidget } from "@/types/state";

export default function Page() {
  const [spawned, setSpawned] = useState<SpawnedWidget[]>([]);
  const expectedDumbIds = useRef<Set<string>>(new Set());
  const { agent } = useAgent({ agentId: "orchestrator" });
  const { copilotkit } = useCopilotKit();
  const autoSentRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-send dream from landing page
  useEffect(() => {
    if (autoSentRef.current) return;
    const stored = sessionStorage.getItem("dreamrag_dream");
    if (!stored) return;
    autoSentRef.current = true;
    sessionStorage.removeItem("dreamrag_dream");
    setIsLoading(true);
    agent.addMessage({ id: randomUUID(), role: "user", content: stored });
    copilotkit.runAgent({ agent });
  }, [agent, copilotkit]);

  // Track agent running state for loading
  useEffect(() => {
    if (spawned.length > 0) setIsLoading(false);
  }, [spawned]);

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onStateChanged: ({ state: s }) => {
        const activeWidgets: ActiveWidget[] = (s as any).active_widgets ?? [];
        const widgetState: Record<string, any> = (s as any).widget_state ?? {};

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

  const isRunning = agent.isRunning;
  const hasWidgets = spawned.length > 0;
  const [input, setInput] = useState("");

  const handleSend = useCallback(() => {
    if (!input.trim() || isRunning) return;
    const text = input;
    setInput("");
    setIsLoading(true);
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
            onOptimisticRender={(w) => {
              expectedDumbIds.current = new Set([w.id]);
            }}
          />
        ))}

      <div style={shellBg}>
        {/* Ambient glow layers */}
        <div style={glowTop} />
        <div style={glowBottom} />

        {/* Shared nav */}
        <NavShell />

        {/* Page label */}
        <section style={pageLabelStyle}>
          <small style={pageLabelSmallStyle}>Dashboard</small>
          <h1 style={pageLabelH1Style}>The dream is open now.</h1>
        </section>

        {/* Widget grid or loading skeleton */}
        <div style={gridWrapStyle}>
          {hasWidgets ? (
            <WidgetPanel spawned={spawned} />
          ) : isLoading || isRunning ? (
            <SkeletonCards />
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Floating chat pill */}
        <div style={chatPillWrap}>
          <div style={chatPillStyle}>
            <input
              autoFocus
              style={chatInputStyle}
              disabled={isRunning}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
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
                onClick={handleSend}
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
        <div key={i} style={{ ...skeletonCardStyle, animationDelay: `${i * 0.15}s` }}>
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
  minHeight: "100dvh",
  fontFamily: '"Manrope", sans-serif',
  color: "#403852",
  background: `
    radial-gradient(circle at 12% 18%, rgba(214, 241, 231, 0.9), transparent 24%),
    radial-gradient(circle at 84% 10%, rgba(227, 220, 255, 0.92), transparent 30%),
    radial-gradient(circle at 82% 82%, rgba(250, 223, 232, 0.82), transparent 24%),
    radial-gradient(circle at 28% 74%, rgba(203, 224, 255, 0.7), transparent 22%),
    linear-gradient(160deg, #f8f4ee 0%, #f2edf7 46%, #fbf7f0 100%)
  `,
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
  paddingBottom: 120,
};

const chatPillWrap: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
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
  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
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
