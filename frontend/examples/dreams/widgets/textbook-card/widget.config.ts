import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "textbook_card",
  tool: {
    name: "show_textbook_card",
    description:
      "Show an authoritative textbook excerpt styled as a literary blockquote. excerpt must be a direct quote or close paraphrase from a dream_knowledge chunk — not invented. [Layout: third width, medium height]",
    parameters: {
      symbol:           { type: "string", description: "The dream symbol name, e.g. 'Water'" },
      excerpt:          { type: "string", description: "Direct quote or close paraphrase from a retrieved dream_knowledge chunk" },
      author:           { type: "string", description: "Author name, e.g. 'C.G. Jung'" },
      source:           { type: "string", description: "Book/source title" },
      source_chunk_ids: { type: "array",  description: "ID of the dream_knowledge chunk this excerpt came from" },
    },
  },
  agent: null,
  layout: { width: "third", height: "medium" },
};

export default config;
