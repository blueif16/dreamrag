import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "stat_card",
  tool: {
    name: "show_stat_card",
    description:
      "Show a bold statistical metric card comparing personal dream data to DreamBank population norms. [Layout: third width, compact height]",
    parameters: {
      label:       { type: "string", description: "Metric label, e.g. 'Water Frequency'" },
      personal:    { type: "number", description: "User's percentage value, e.g. 31" },
      baseline:    { type: "number", description: "Population baseline percentage, e.g. 12" },
      description: { type: "string", description: "One-line context, e.g. 'of your dreams feature water'" },
    },
  },
  agent: null,
  layout: { width: "third", height: "compact" },
};

export default config;
