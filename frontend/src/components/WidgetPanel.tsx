"use client";

import { Suspense } from "react";
import { widgetEntries } from "@/lib/widgetEntries";
import type { SpawnedWidget } from "@/lib/types";
import type { WidgetLayout } from "@/types/state";

function layoutClasses(layout?: WidgetLayout): string {
  const w = layout?.width ?? "half";
  const h = layout?.height ?? "compact";
  const widthClass =
    w === "full"
      ? "col-span-3"
      : w === "half"
      ? "col-span-2"
      : "col-span-1";
  const heightClass =
    h === "fill"
      ? "min-h-[calc(100vh-8rem)]"
      : h === "tall"
      ? "min-h-[500px]"
      : h === "medium"
      ? "min-h-[300px]"
      : "";
  return `${widthClass} ${heightClass}`.trim();
}

interface Props {
  spawned: SpawnedWidget[];
}

export function WidgetPanel({ spawned }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3 h-full auto-rows-min">
      {spawned.map(({ id, Component, props }) => {
        const entry = widgetEntries.find((e) => e.config.id === id);
        return (
          <div key={id} className={layoutClasses(entry?.config.layout)}>
            <Suspense fallback={<div className="animate-pulse h-32 rounded-[20px]" style={{ background: "rgba(238,234,255,0.3)" }} />}>
              <Component {...props} widgetId={id} />
            </Suspense>
          </div>
        );
      })}
    </div>
  );
}
