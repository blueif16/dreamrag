import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "dream_atmosphere",
  tool: {
    name: "show_dream_atmosphere",
    description:
      "Show a symbol network visualization with floating particle effects for the dream atmosphere. [Layout: half width, tall height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
