import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "heatmap_calendar",
  tool: {
    name: "show_heatmap_calendar",
    description:
      "Show a GitHub-style heatmap calendar of dream recording frequency over the past month. [Layout: half width, compact height]",
    parameters: {
      month: { type: "string", description: "Month label, e.g. 'March'" },
      data:  { type: "array",  description: "7-row x N-col 2D array of activity levels 0-4 (rows=days Mon-Sun, cols=weeks)" },
    },
  },
  agent: null,
  layout: { width: "half", height: "compact" },
};

export default config;
