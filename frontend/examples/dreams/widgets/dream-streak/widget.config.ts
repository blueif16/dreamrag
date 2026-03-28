import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "dream_streak",
  tool: {
    name: "show_dream_streak",
    description:
      "Show a streak stat card indicating how many consecutive days dreams have been recorded. [Layout: third width, compact height]",
    parameters: {
      streak: { type: "number", description: "Current consecutive day streak, e.g. 27" },
      last7:  { type: "array",  description: "Array of 7 booleans (most recent last), true=recorded, false=missed" },
    },
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
