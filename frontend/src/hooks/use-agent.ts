"use client";

import { useAgent as useV2Agent, UseAgentUpdate } from "@copilotkitnext/react";
import { useState, useEffect } from "react";

/** Base state shared by all apps. Extend with your own fields. */
export interface BaseAgentState {
  metadata: Record<string, any>;
}

export function useAgent<T extends BaseAgentState = BaseAgentState>(
  options?: { name?: string; initialState?: Partial<T> }
) {
  const { agent } = useV2Agent({
    agentId: options?.name ?? "orchestrator",
    updates: [UseAgentUpdate.OnStateChanged, UseAgentUpdate.OnRunStatusChanged],
  });

  const [state, setState] = useState<T>(agent.state as T);
  const [running, setRunning] = useState<boolean>(agent.isRunning);

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onStateChanged: ({ state: s }) => setState(s as T),
      onRunInitialized: () => setRunning(true),
      onRunFinalized: () => setRunning(false),
      onRunFailed: () => setRunning(false),
    });
    return unsubscribe;
  }, [agent]);

  return {
    state,
    setState: (s: T) => agent.state,
    run: () => agent.runAgent(),
    stop: () => agent.abortRun(),
    running,
    agentName: options?.name ?? "orchestrator",
  };
}
