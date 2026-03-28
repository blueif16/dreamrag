"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAgent } from "@copilotkitnext/react";
import { useCopilotKit } from "@copilotkitnext/react";
import { randomUUID } from "@ag-ui/client";
import { Chat } from "@/components/chat";
import { WidgetPanel } from "@/components/WidgetPanel";
import { WidgetToolRegistrar } from "@/components/WidgetToolRegistrar";
import { widgetEntries } from "@/lib/widgetEntries";
import type { SpawnedWidget } from "@/lib/types";
import type { ActiveWidget } from "@/types/state";
import { cn } from "@/lib/utils";

export type LayoutMode = "initial" | "chatting" | "with_canvas";

export default function Page() {
  const [spawned, setSpawned] = useState<SpawnedWidget[]>([]);
  const expectedDumbIds = useRef<Set<string>>(new Set());
  const hasWidgets = spawned.length > 0;
  const { agent } = useAgent({ agentId: "orchestrator" });

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

      {hasWidgets ? (
        <CanvasView agent={agent} spawned={spawned} />
      ) : (
        <div style={{
          background: "linear-gradient(135deg, #EEEAFF 0%, #FFF9F2 100%)",
          minHeight: "100dvh",
        }}>
          <Chat agent={agent} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Canvas view — full-width bento grid + floating bottom chat pill
// ---------------------------------------------------------------------------

function CanvasView({ agent, spawned }: { agent: any; spawned: SpawnedWidget[] }) {
  const { copilotkit } = useCopilotKit();
  const isRunning = agent.isRunning;
  const [input, setInput] = useState("");

  const handleSend = useCallback(() => {
    if (!input.trim() || isRunning) return;
    const text = input;
    setInput("");
    agent.addMessage({ id: randomUUID(), role: "user", content: text });
    copilotkit.runAgent({ agent });
  }, [input, isRunning, agent, copilotkit]);

  return (
    <div
      className="relative min-h-dvh w-full"
      style={{ background: "linear-gradient(135deg, #EEEAFF 0%, #FFF9F2 100%)" }}
    >
      {/* Bento grid — full viewport width, padded, with bottom space for chat pill */}
      <div className="px-6 pt-6 pb-32">
        <WidgetPanel spawned={spawned} />
      </div>

      {/* Floating chat pill — fixed at bottom center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg"
          style={{
            background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 8px 32px rgba(91,110,175,0.15), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#9B8FC4]"
            style={{ color: "#2D2640", fontFamily: "DM Sans, sans-serif" }}
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors"
              style={{ background: "rgba(91,110,175,0.15)" }}
              onClick={() => agent.abortRun()}
              type="button"
              title="Stop"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#5B6EAF">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
                input.trim()
                  ? "opacity-100 cursor-pointer"
                  : "opacity-40 cursor-default"
              )}
              style={{ background: "linear-gradient(135deg, #5B6EAF, #7B5EA7)" }}
              disabled={!input.trim()}
              onClick={handleSend}
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
  );
}
