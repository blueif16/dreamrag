import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "lucidity_gauge",
  tool: {
    name: "show_lucidity_gauge",
    description:
      "Show a radial gauge indicating the lucidity level of a dream. [Layout: third width, compact height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
