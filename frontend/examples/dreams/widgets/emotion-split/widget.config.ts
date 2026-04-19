import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "emotion_split",
  tool: {
    name: "show_emotion_split",
    description:
      "Show horizontal bar charts comparing emotion distribution for a specific dream symbol vs overall emotion distribution. Instant visual comparison. [Layout: third width, medium height]",
    parameters: {
      symbol:           { type: "string", description: "The symbol being compared, e.g. 'Water'" },
      symbol_emotions:  { type: "array",  description: "Array of {label: string, value: number} emotions for this symbol" },
      overall_emotions: { type: "array",  description: "Array of {label: string, value: number} emotions across all dreams" },
    },
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
