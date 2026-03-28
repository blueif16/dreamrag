import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "current_dream",
  tool: {
    name: "show_current_dream",
    description:
      "Show the current dream reading with meaning, subconscious emotion, and life echo panels. " +
      "Synthesize all content FROM retrieved chunks — never invent. [Layout: half width, tall height]",
    parameters: {
      title:                { type: "string", description: "Short dream title, e.g. 'Water under the old house'" },
      quote:                { type: "string", description: "The dream narrative text as recalled by the user" },
      meaning:              { type: "string", description: "Synthesized from dream_knowledge chunks — symbolic/psychological meaning" },
      subconscious_emotion: { type: "string", description: "Synthesized from dream_knowledge emotional theory chunks" },
      life_echo:            { type: "string", description: "Synthesized from community_dreams chunks — how this pattern shows up in others' dreams" },
      source_chunk_ids:     { type: "array",  description: "IDs of retrieved chunks (id field from search_dreams results) that backed this widget" },
    },
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
