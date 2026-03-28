import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "lucidity_gauge",
  tool: {
    name: "show_lucidity_gauge",
    description:
      "Show a radial gauge indicating the lucidity level of a dream. [Layout: third width, compact height]",
    parameters: {
      level: { type: "number", description: "Lucidity level from 0.0 to 1.0, e.g. 0.25" },
      label: { type: "string", description: "Text label for the level, e.g. 'Low', 'Medium', 'High'" },
    },
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
