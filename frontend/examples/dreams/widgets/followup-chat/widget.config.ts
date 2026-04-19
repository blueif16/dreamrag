import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "followup_chat",
  tool: {
    name: "show_followup_chat",
    description:
      "Show suggested follow-up questions the USER might want to ask next about their dream. " +
      "These are written from the user's perspective — things they could tap to continue exploring — NOT questions the assistant is asking the user. " +
      "Each prompt should reference a specific concept from the retrieved dream_knowledge and community_dreams chunks. [Layout: third width, tall height]",
    parameters: {
      dream_title:      { type: "string", description: "The dream title being discussed" },
      prompts:          { type: "array",  description: "2-4 follow-up questions phrased from the user's first-person perspective (e.g. 'What does the falling symbol mean in Jung's work?', 'Why do I keep dreaming about teeth?'). NEVER phrase as the assistant asking the user (e.g. 'What in your waking life feels...' is WRONG). These are tappable suggestions for what the user might ask next." },
      source_chunk_ids: { type: "array",  description: "IDs of retrieved chunks that inspired these prompts" },
    },
  },
  agent: null,
  layout: { width: "third", height: "tall" },
};

export default config;
