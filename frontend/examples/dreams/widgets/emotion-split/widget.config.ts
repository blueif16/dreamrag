import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "emotion_split",
  tool: {
    name: "show_emotion_split",
    description:
      "Show two donut charts comparing emotion distribution for a specific dream symbol vs overall emotion distribution. [Layout: third width, medium height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
