import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "textbook_card",
  tool: {
    name: "show_textbook_card",
    description:
      "Show an authoritative textbook excerpt card for a dream symbol with serif typography and source citation. [Layout: third width, medium height]",
    parameters: {},
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
