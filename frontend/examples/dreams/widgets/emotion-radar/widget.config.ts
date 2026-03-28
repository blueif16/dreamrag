import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "emotion_radar",
  tool: {
    name: "show_emotion_radar",
    description:
      "Show a spider/radar chart of the emotional current across dream axes. [Layout: third width, medium height]",
    parameters: {
      axes: {
        type: "array",
        description: "Array of {label: string, value: number (0-1)} emotion axes, e.g. [{label:'Anxiety',value:0.38},...]",
      },
    },
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
