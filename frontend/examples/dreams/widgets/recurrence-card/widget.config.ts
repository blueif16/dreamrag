import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "recurrence_card",
  tool: {
    name: "show_recurrence_card",
    description:
      "Show symbol recurrence statistics including frequency and cycle data. [Layout: third width, medium height]",
    parameters: {
      metrics: {
        type: "array",
        description: "Array of {label: string, value: string, note: string} recurrence metrics, e.g. [{label:'water',value:'16.2%',note:'Returns with night and house imagery.'}]",
      },
    },
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
