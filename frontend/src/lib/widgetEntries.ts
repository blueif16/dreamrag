import type { WidgetConfig } from "@/types/state";
import type { ComponentType } from "react";
import * as allExamples from "../../examples";

export interface WidgetEntry {
  config: WidgetConfig;
  Component: ComponentType<any>;
}

/**
 * Load all widgets from ALL examples.
 * Each example is a separate app - they all load together.
 */
function buildWidgetEntries(): WidgetEntry[] {
  const entries: WidgetEntry[] = [];
  const examples = Object.values(allExamples);

  for (const example of examples) {
    const configs: WidgetConfig[] = [];
    const components: Record<string, ComponentType<any>> = {};

    console.log("[widgetEntries] Example module keys:", Object.keys(example || {}));

    for (const [key, value] of Object.entries(example || {})) {
      if (value && typeof value === "object" && "tool" in value && "id" in value) {
        configs.push(value as WidgetConfig);
        console.log(`[widgetEntries] Found config: id=${(value as any).id}, tool=${(value as any).tool?.name}`);
      } else if (typeof value === "function") {
        components[key] = value as ComponentType<any>;
        console.log(`[widgetEntries] Found component: ${key}`);
      }
    }

    for (const config of configs) {
      const componentName = config.id
        .split("_")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join("");

      const Component = components[componentName];
      if (Component) {
        entries.push({ config, Component });
        console.log(`[widgetEntries] ✅ Matched: ${config.id} → ${componentName}`);
      } else {
        console.warn(`[widgetEntries] ❌ No component match for config "${config.id}" (looked for "${componentName}", available: ${Object.keys(components).join(", ")})`);
      }
    }
  }

  console.log(`[widgetEntries] Total entries built: ${entries.length}`, entries.map(e => e.config.tool.name));
  return entries;
}

export const widgetEntries: WidgetEntry[] = buildWidgetEntries();
