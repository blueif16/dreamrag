"use client";

import { useFrontendTool, useCopilotKit } from "@copilotkitnext/react";
import { z } from "zod";
import type { WidgetEntry, SpawnedWidget } from "@/lib/types";
import { isWidgetEmpty } from "@/lib/widgetEmpty";
import { Dispatch, MutableRefObject, SetStateAction } from "react";

interface Props {
  entry: WidgetEntry;
  setSpawned: Dispatch<SetStateAction<SpawnedWidget[]>>;
  onOptimisticRender?: (w: SpawnedWidget) => void;
  replaceAllGuard: MutableRefObject<boolean>;
}

export function WidgetToolRegistrar({ entry, setSpawned, onOptimisticRender, replaceAllGuard }: Props) {
  const { copilotkit } = useCopilotKit();

  // logging removed — tools bind correctly

  const parameters = z.object({
    ...Object.fromEntries(
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
    ),
    operation: z.string()
      .describe("Canvas placement: 'replace_all' clears all widgets then shows this one (default), 'add' adds alongside existing widgets, 'replace_one' removes only this widget's id then adds it.")
      .default("replace_all"),
  });

  useFrontendTool(
    {
      name: entry.config.tool.name,
      description: entry.config.tool.description,
      parameters,
      handler: async (args) => {
        let operation: string = (args as any).operation ?? "replace_all";
        // Guard: only the first replace_all in a batch actually clears
        if (operation === "replace_all") {
          if (replaceAllGuard.current) {
            operation = "add";
          } else {
            replaceAllGuard.current = true;
          }
        }
        // Skip spawn entirely when content is empty — don't reserve a grid slot
        // for a widget that will render null.
        if (isWidgetEmpty(entry.config.id, args as Record<string, unknown>)) {
          return JSON.stringify({
            spawned: false,
            widgetId: entry.config.id,
            reason: "empty_content",
          });
        }
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
