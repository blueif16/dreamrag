import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "dream_atmosphere",
  tool: {
    name: "show_dream_atmosphere",
    description:
      "Show a symbol network visualization with floating particle effects for the dream atmosphere. [Layout: half width, tall height]",
    parameters: {
      center_symbol: { type: "string", description: "The central dream symbol, e.g. 'Water'" },
      satellites:    { type: "array",  description: "Array of satellite symbol label strings, e.g. ['Falling','House','Night']" },
    },
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
