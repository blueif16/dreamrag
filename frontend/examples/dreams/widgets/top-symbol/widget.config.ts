import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "top_symbol",
  tool: {
    name: "show_top_symbol",
    description:
      "Show the most frequently occurring dream symbol with co-occurrence data. [Layout: third width, compact height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
