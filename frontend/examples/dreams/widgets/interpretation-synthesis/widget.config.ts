import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "interpretation_synthesis",
  tool: {
    name: "show_interpretation_synthesis",
    description:
      "Show a rich multi-source interpretation synthesis card. Each paragraph must be synthesized from retrieved chunks — tag source as 'personal' (user_dreams), 'textbook' (dream_knowledge), or 'community' (community_dreams). [Layout: half width, tall height]",
    parameters: {
      symbol:           { type: "string", description: "The dream symbol or theme, e.g. 'Water'" },
      subtitle:         { type: "string", description: "A poetic subtitle synthesized from retrieved content" },
      paragraphs:       { type: "array",  description: "Array of {text: string, source: 'personal'|'textbook'|'community'} — each paragraph from a different namespace's chunks" },
      source_chunk_ids: { type: "array",  description: "IDs of all retrieved chunks used across all paragraphs" },
    },
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
