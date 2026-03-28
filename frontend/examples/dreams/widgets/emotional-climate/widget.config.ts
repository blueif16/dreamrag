import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "emotional_climate",
  tool: {
    name: "show_emotional_climate",
    description:
      "Show emotional distribution across user's dream history. Self-contained — widget fetches user profile data directly from /api/user-profile. Call with NO parameters. [Layout: half width, medium height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "half", height: "medium" },
};

export default config;
