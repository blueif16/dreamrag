import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "community_mirror",
  tool: {
    name: "show_community_mirror",
    description:
      "Show anonymized community dream snippets that mirror the user's dream symbol, with emotion tags and similarity scores. [Layout: third width, medium height]",
    parameters: {
      symbol:   { type: "string", description: "The symbol being mirrored, e.g. 'water'" },
      snippets: {
        type: "array",
        description: "Array of {text: string, emotions: string[], similarity: number} community dream snippets",
      },
    },
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
