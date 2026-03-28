import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "textbook_card",
  tool: {
    name: "show_textbook_card",
    description:
      "Show an authoritative textbook excerpt card for a dream symbol with serif typography and source citation. [Layout: third width, medium height]",
    parameters: {
      symbol:  { type: "string", description: "The dream symbol name, e.g. 'Water'" },
      excerpt: { type: "string", description: "The textbook quote about this symbol" },
      author:  { type: "string", description: "Author name, e.g. 'C.G. Jung'" },
      source:  { type: "string", description: "Book/source title, e.g. 'The Archetypes and the Collective Unconscious, Vol. 9i'" },
    },
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
