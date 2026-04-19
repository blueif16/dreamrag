import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "echoes_card",
  tool: {
    name: "show_echoes_card",
    description:
      "Show past dream echoes as a timeline thread. Populate from search_dreams results against user_{id}_dreams namespace — use the actual returned content as echoes, not invented text. [Layout: third width, compact height]",
    parameters: {
      echoes:           { type: "array",  description: "Array of {date: string, title: string, text: string} — use content from user past dream search results, up to 3" },
      source_chunk_ids: { type: "array",  description: "IDs of the user past dream chunks these echoes came from" },
    },
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
