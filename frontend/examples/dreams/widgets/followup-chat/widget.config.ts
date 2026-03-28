import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "followup_chat",
  tool: {
    name: "show_followup_chat",
    description:
      "Show a follow-up chat panel for continuing dream conversation with prompt suggestions. [Layout: third width, tall height]",
    parameters: {
      dream_title: { type: "string", description: "The dream title being discussed, e.g. 'Water under the old house'" },
      prompts:     { type: "array",  description: "Array of suggested follow-up prompt strings, 2-4 items" },
    },
  },
  agent: null,
  layout: { width: "third", height: "tall" },
};

export default config;
