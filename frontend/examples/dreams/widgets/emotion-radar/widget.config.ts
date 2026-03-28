import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "emotion_radar",
  tool: {
    name: "show_emotion_radar",
    description:
      "Show a spider/radar chart of the emotional current across dream axes. [Layout: third width, medium height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
