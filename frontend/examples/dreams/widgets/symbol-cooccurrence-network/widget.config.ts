import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "symbol_cooccurrence_network",
  tool: {
    name: "show_symbol_cooccurrence_network",
    description:
      "Show a symbol co-occurrence network graph. Central symbol node with connected symbols sized by edge weight, plus a text summary of connections. [Layout: half width, tall height]",
    parameters: {
      center_symbol: { type: "string", description: "The central symbol, e.g. 'Water'" },
      nodes: {
        type: "array",
        description: "Array of {label: string, weight: number (0-1)} co-occurring symbols sorted by weight descending",
      },
    },
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
