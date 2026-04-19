import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "emotional_climate",
  tool: {
    name: "show_emotional_climate",
    description:
      "Show the emotional landscape across the user's dream history as elegant horizontal bars. Self-contained — widget fetches user profile data directly from /api/user-profile. Call with NO parameters. [Layout: half width, medium height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "half", height: "medium" },
};

export default config;
