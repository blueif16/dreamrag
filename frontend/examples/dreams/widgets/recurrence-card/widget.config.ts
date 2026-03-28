import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "recurrence_card",
  tool: {
    name: "show_recurrence_card",
    description:
      "Show symbol recurrence statistics from user's dream history. Self-contained — widget fetches user profile data directly from /api/user-profile. Call with NO parameters. [Layout: third width, medium height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
