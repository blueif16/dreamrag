import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "current_dream",
  tool: {
    name: "show_current_dream",
    description:
      "Show the current dream reading with meaning, subconscious emotion, and life echo panels. [Layout: half width, tall height]",
    parameters: {
      title:               { type: "string", description: "Short dream title, e.g. 'Water under the old house'" },
      quote:               { type: "string", description: "The dream narrative text as recalled by the user" },
      meaning:             { type: "string", description: "Interpretation of the dream's meaning" },
      subconscious_emotion:{ type: "string", description: "The underlying emotional state, e.g. 'Gentle anxiety: searching, not defensive'" },
      life_echo:           { type: "string", description: "How this dream echoes waking life patterns" },
    },
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
