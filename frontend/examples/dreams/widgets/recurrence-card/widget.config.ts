import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "recurrence_card",
  tool: {
    name: "show_recurrence_card",
    description:
      "Show symbol recurrence statistics including frequency and cycle data. [Layout: third width, medium height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
