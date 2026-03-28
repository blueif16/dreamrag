import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "emotional_climate",
  tool: {
    name: "show_emotional_climate",
    description:
      "Show a horizontal bar chart of the emotional distribution across recent dreams. [Layout: half width, medium height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "half", height: "medium" },
};

export default config;
