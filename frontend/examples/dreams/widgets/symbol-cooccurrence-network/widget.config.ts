import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "symbol_cooccurrence_network",
  tool: {
    name: "show_symbol_cooccurrence_network",
    description:
      "Show a ranked list of symbols that co-occur with a central symbol. Each row renders as a weighted bar with a percentage. [Layout: half width, medium height]",
    parameters: {
      center_symbol: { type: "string", description: "The central symbol, e.g. 'Water'" },
      nodes: {
        type: "array",
        description: "Array of {label: string, weight: number (0-1)} co-occurring symbols sorted by weight descending",
      },
    },
  },
  agent: null,
  layout: { width: "half", height: "medium" },
};

export default config;
