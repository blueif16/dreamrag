import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "followup_chat",
  tool: {
    name: "show_followup_chat",
    description:
      "Show a follow-up chat panel with prompt suggestions grounded in retrieved chunks. " +
      "Prompts should probe specific concepts found in the retrieved dream_knowledge and community_dreams results. [Layout: third width, tall height]",
    parameters: {
      dream_title:      { type: "string", description: "The dream title being discussed" },
      prompts:          { type: "array",  description: "2-4 follow-up prompt strings that probe concepts from retrieved chunks" },
      source_chunk_ids: { type: "array",  description: "IDs of retrieved chunks that inspired these prompts" },
    },
  },
  agent: null,
  layout: { width: "third", height: "tall" },
};

export default config;
