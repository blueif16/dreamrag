/** Scaffold type definitions. Extend with your app-specific types. */

import type { ComponentType } from "react";

export type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};

export interface SpawnedWidget {
  id: string;
  Component: ComponentType<any>;
  props: Record<string, any>;
}

export interface WidgetEntry {
  config: {
    id: string;
    tool: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
    agent: any;
    layout?: any;
  };
  Component: ComponentType<any>;
}
