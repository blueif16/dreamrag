import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "recurrence_card",
  tool: {
    name: "show_recurrence_card",
    description:
      "Show recurring dream symbols with frequency indicators. Self-contained — widget fetches user profile data directly from /api/user-profile. Call with NO parameters. [Layout: half width, medium height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "half", height: "medium" },
};

export default config;
