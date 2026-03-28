import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "interpretation_synthesis",
  tool: {
    name: "show_interpretation_synthesis",
    description:
      "Show a rich multi-source interpretation synthesis card for a dream symbol or theme. Use for symbol queries. [Layout: half width, tall height]",
    parameters: {
      symbol:     { type: "string", description: "The dream symbol or theme, e.g. 'Water'" },
      subtitle:   { type: "string", description: "A poetic subtitle, e.g. 'The unconscious sea within'" },
      paragraphs: {
        type: "array",
        description: "Array of {text: string, source: 'personal'|'textbook'|'community'} interpretation paragraphs",
      },
    },
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
