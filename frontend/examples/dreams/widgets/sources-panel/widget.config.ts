import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "sources_panel",
  tool: {
    name: "show_sources_panel",
    description:
      "Show a reading trail panel listing the sources and references behind a dream interpretation. [Layout: third width, medium height]",
    parameters: {
      sources: {
        type: "array",
        description: "Array of {title: string, note: string} sources used in the interpretation",
      },
    },
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
