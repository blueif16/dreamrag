import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "followup_chat",
  tool: {
    name: "show_followup_chat",
    description:
      "Show a follow-up chat panel for continuing dream conversation with prompt suggestions. [Layout: third width, tall height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "tall" },
};

export default config;
