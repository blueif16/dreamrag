function parseArrayLike(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "[]") return [];
    try { const p = JSON.parse(t); if (Array.isArray(p)) return p; } catch {}
    try { const p = JSON.parse(t.replace(/'/g, '"')); if (Array.isArray(p)) return p; } catch {}
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function isWidgetEmpty(id: string, props: Record<string, unknown>): boolean {
  switch (id) {
    case "community_mirror": return !parseArrayLike(props.snippets).length;
    case "echoes_card": return !parseArrayLike(props.echoes).length;
    case "dream_atmosphere": return !parseArrayLike(props.satellites).length;
    case "symbol_cooccurrence_network": return !parseArrayLike(props.nodes).length;
    case "interpretation_synthesis": return !parseArrayLike(props.paragraphs).length;
    case "emotion_split":
      return !parseArrayLike(props.symbol_emotions).length
          && !parseArrayLike(props.overall_emotions).length;
    case "textbook_card": return !props.excerpt;
    case "followup_chat": return !parseArrayLike(props.prompts).length;
    case "current_dream": return !props.meaning && !props.title;
    default: return false;
  }
}
