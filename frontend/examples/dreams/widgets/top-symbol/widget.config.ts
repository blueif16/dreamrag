import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "top_symbol",
  tool: {
    name: "show_top_symbol",
    description:
      "Show the most frequently occurring dream symbol with co-occurrence pills. [Layout: third width, compact height]",
    parameters: {
      symbol: {
        type: "string",
        description: "The top symbol name, e.g. 'Water'",
      },
      count: {
        type: "number",
        description: "How many times it appeared, e.g. 9",
      },
      window: {
        type: "string",
        description: "Time window, e.g. 'last 30 dreams'",
      },
      cooccurrences: {
        type: "array",
        description:
          "Array of {label: string, count: number} co-occurring symbols",
      },
    },
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
