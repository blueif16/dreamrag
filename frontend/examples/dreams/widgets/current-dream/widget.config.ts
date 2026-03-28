import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "current_dream",
  tool: {
    name: "show_current_dream",
    description:
      "Show the current dream reading with meaning, subconscious emotion, and life echo panels. [Layout: half width, tall height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "half", height: "tall" },
};

export default config;
