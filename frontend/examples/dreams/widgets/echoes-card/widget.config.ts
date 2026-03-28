import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "echoes_card",
  tool: {
    name: "show_echoes_card",
    description:
      "Show past dream echoes with date, title, and interpretive snippet. [Layout: third width, compact height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
