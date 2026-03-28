import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "community_mirror",
  tool: {
    name: "show_community_mirror",
    description:
      "Show anonymized community dream snippets. snippets must come directly from community_dreams search results — use the actual returned content and scores. [Layout: third width, medium height]",
    parameters: {
      symbol:           { type: "string", description: "The symbol being mirrored, e.g. 'water'" },
      snippets:         { type: "array",  description: "Array of {text: string, emotions: string[], similarity: number} — taken from community_dreams search results, similarity = score from result" },
      source_chunk_ids: { type: "array",  description: "IDs of the community_dreams chunks used as snippets" },
    },
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
