import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "dream_atmosphere",
  tool: {
    name: "show_dream_atmosphere",
    description:
      "Show a symbol network visualization for the dream atmosphere. " +
      "Extract center_symbol and satellites from dream_knowledge chunk content — symbols that appear or co-occur in retrieved text. [Layout: half width, tall height]",
    parameters: {
      center_symbol:    { type: "string", description: "The dominant dream symbol extracted from the dream text and confirmed in retrieved chunks" },
      satellites:       { type: "array",  description: "Related symbol strings extracted from dream_knowledge chunk content, e.g. ['Falling','House','Night']" },
      source_chunk_ids: { type: "array",  description: "IDs of retrieved chunks that surfaced these symbols" },
    },
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
