"use client";

import { useFrontendTool, useCopilotKit } from "@copilotkitnext/react";
import { z } from "zod";
import type { WidgetEntry, SpawnedWidget } from "@/lib/types";
import { Dispatch, SetStateAction } from "react";

interface Props {
  entry: WidgetEntry;
  setSpawned: Dispatch<SetStateAction<SpawnedWidget[]>>;
  onOptimisticRender?: (w: SpawnedWidget) => void;
}

export function WidgetToolRegistrar({ entry, setSpawned, onOptimisticRender }: Props) {
  const { copilotkit } = useCopilotKit();

  console.log(`[WT] mount: ${entry.config.tool.name} tools=${(copilotkit as any).runHandler?._tools?.length ?? 'N/A'}`);

  const parameters = z.object(
    Object.fromEntries(
      Object.entries(entry.config.tool.parameters).map(([key, param]) => {
        let schema: z.ZodTypeAny;
        switch (param.type) {
          case "number":
            schema = z.number().describe(param.description || "");
            break;
          case "boolean":
            schema = z.boolean().describe(param.description || "");
            break;
          default:
            schema = z.string().describe(param.description || "");
        }
        if (param.default !== undefined) {
          schema = schema.default(param.default);
        }
        return [key, schema];
      })
    )
  );

  useFrontendTool(
    {
      name: entry.config.tool.name,
      description: entry.config.tool.description,
      parameters,
      handler: async (args) => {
        const operation: string = (args as any).operation ?? "replace_all";
        const widget: SpawnedWidget = { id: entry.config.id, Component: entry.Component, props: args };
        // Latch before setSpawned so onStateChanged mid-run never wipes it.
        onOptimisticRender?.(widget);
        setSpawned((prev) => {
          const base = operation === "replace_all" ? [] : prev.filter((w) => w.id !== entry.config.id);
          return [...base, widget];
        });
        return JSON.stringify({
          spawned: true,
          widgetId: entry.config.id,
          operation,
          props: args,
        });
      },
      render: ({ status }) => (
        <div className="text-sm text-muted-foreground">
          {status === "complete" ? "done" : "loading"} {entry.config.tool.name}
        </div>
      ),
    },
    []
  );

  return null;
}
