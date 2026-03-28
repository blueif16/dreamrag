import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "emotional_climate",
  tool: {
    name: "show_emotional_climate",
    description:
      "Show a horizontal bar chart of the emotional distribution across recent dreams. [Layout: half width, medium height]",
    parameters: {
      emotions: {
        type: "array",
        description: "Array of {label: string, pct: number} emotions sorted by percentage descending, e.g. [{label:'Gentle anxiety',pct:38},...]",
      },
    },
  },
  agent: null,
  layout: { width: "half", height: "medium" },
};

export default config;
