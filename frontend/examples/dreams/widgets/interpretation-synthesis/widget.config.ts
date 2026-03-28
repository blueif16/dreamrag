import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "interpretation_synthesis",
  tool: {
    name: "show_interpretation_synthesis",
    description:
      "Show a rich multi-source interpretation synthesis card for a dream symbol or theme. Use for symbol queries. [Layout: half width, tall height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
