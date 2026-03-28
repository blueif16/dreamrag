import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "dream_streak",
  tool: {
    name: "show_dream_streak",
    description:
      "Show a streak stat card indicating how many consecutive days dreams have been recorded. [Layout: third width, compact height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
