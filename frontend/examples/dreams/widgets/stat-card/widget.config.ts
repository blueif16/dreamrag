import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "stat_card",
  tool: {
    name: "show_stat_card",
    description:
      "Show a bold statistical metric card comparing personal dream data to DreamBank population norms. [Layout: third width, compact height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
