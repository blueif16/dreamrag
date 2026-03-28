import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "heatmap_calendar",
  tool: {
    name: "show_heatmap_calendar",
    description:
      "Show a GitHub-style heatmap calendar of dream recording frequency over the past month. [Layout: half width, compact height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "half", height: "compact" },
};

export default config;
