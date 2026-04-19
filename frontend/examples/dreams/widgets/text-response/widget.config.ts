import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "text_response",
  tool: {
    name: "show_text_response",
    description:
      "Deliver a conversational text answer when visualization widgets aren't the right fit — e.g. the user asks a clarifying question, wants a short discussion, or requests an answer the dashboard widgets don't cover. Prefer spawning structural widgets (current_dream, community_mirror, etc.) whenever the answer has structure. Use this for 1–4 sentence conversational replies grounded in retrieved chunks. Plain prose, no markdown. [Layout: full width, compact height]",
    parameters: {
      message:          { type: "string", description: "The natural-language answer as plain prose. 1–4 sentences." },
      source_chunk_ids: { type: "array",  description: "Optional IDs of chunks cited in the message." },
    },
  },
  agent: null,
  layout: { width: "full", height: "compact" },
};

export default config;
