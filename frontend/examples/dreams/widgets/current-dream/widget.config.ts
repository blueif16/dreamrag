import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "current_dream",
  tool: {
    name: "show_current_dream",
    description:
      "Show the dream reading — a clear interpretation grounded in retrieved knowledge. " +
      "Synthesize all content FROM retrieved chunks. meaning should be the main interpretation paragraph. " +
      "subconscious_emotion and life_echo should each be 1-2 sentences max. [Layout: half width, tall height]",
    parameters: {
      title:                { type: "string", description: "Short dream title, e.g. 'Water under the old house'" },
      quote:                { type: "string", description: "The dream narrative text as recalled by the user" },
      meaning:              { type: "string", description: "Synthesized from dream_knowledge chunks — symbolic/psychological meaning" },
      subconscious_emotion: { type: "string", description: "Synthesized from dream_knowledge emotional theory chunks, 1-2 sentences" },
      life_echo:            { type: "string", description: "Synthesized from community_dreams chunks — how this pattern shows up in others' dreams, 1-2 sentences" },
      source_chunk_ids:     { type: "array",  description: "IDs of retrieved chunks (id field from search_dreams results) that backed this widget" },
    },
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
