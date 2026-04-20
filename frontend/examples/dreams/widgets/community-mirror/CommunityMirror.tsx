const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
`;

const EMOTION_COLORS: Record<string, { bg: string; color: string }> = {
  anxiety:   { bg: "rgba(196,137,156,0.12)", color: "#b07a8c" },
  calm:      { bg: "rgba(125,154,110,0.12)", color: "#6d8a5e" },
  wonder:    { bg: "rgba(201,165,90,0.12)",  color: "#a8904e" },
  awe:       { bg: "rgba(107,95,165,0.12)",  color: "#6b5fa5" },
  nostalgia: { bg: "rgba(107,95,165,0.12)",  color: "#7b6fb5" },
  peace:     { bg: "rgba(125,154,110,0.12)", color: "#6d8a5e" },
  urgency:   { bg: "rgba(212,122,107,0.12)", color: "#b06a5b" },
  joy:       { bg: "rgba(201,165,90,0.12)",  color: "#a8904e" },
  sadness:   { bg: "rgba(107,95,165,0.12)",  color: "#6b5fa5" },
  fear:      { bg: "rgba(139,127,184,0.12)", color: "#8b7fb8" },
  anger:     { bg: "rgba(212,122,107,0.12)", color: "#b06a5b" },
};

interface Snippet { text: string; emotions: string[]; similarity: number }
interface Props { symbol: string; snippets: Snippet[] | string; source_chunk_ids?: string[] }

function parseSnippets(raw: unknown): Snippet[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw.replace(/'/g, '"')); } catch { return []; }
  }
  return [];
}

function formatSimilarity(s: number): string {
  const pct = s < 1 ? Math.round(s * 100) : Math.round(s);
  return `${pct}% similar`;
}

const container: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.65)",
  boxShadow: "0 2px 20px rgba(80,68,100,0.05), inset 0 1px 0 rgba(255,255,255,0.7)",
  padding: "24px 26px",
  display: "flex",
  flexDirection: "column" as const,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  overflow: "hidden",
};

export default function CommunityMirror({ symbol, snippets: rawSnippets }: Props) {
  const snippets = parseSnippets(rawSnippets);
  if (!snippets.length) return null;

  return (
    <div style={container}>
      <style>{FONTS}</style>

      {/* Question label */}
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
        textTransform: "uppercase" as const, color: "#9b8fb8", marginBottom: 10,
      }}>
        Who else dreams about this?
      </div>

      {/* Header */}
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 20, fontWeight: 600, color: "#2d2640",
        lineHeight: 1.2, marginBottom: 14,
      }}>
        Others Dream of {symbol} Too
      </div>

      {/* Snippet cards */}
      <div style={{
        display: "flex", flexDirection: "column" as const, gap: 10,
        flex: 1, overflowY: "auto" as const, minHeight: 0,
      }}>
        {snippets.slice(0, 4).map((s, i) => (
          <div key={i} style={{
            borderLeft: "3px solid #c4899c",
            paddingLeft: 14,
            paddingTop: 2,
            paddingBottom: 2,
          }}>
            {/* Dream text */}
            <p style={{
              margin: 0, fontSize: 13, lineHeight: 1.7,
              color: "#524a65", fontStyle: "italic",
            }}>
              {"\u201C"}{s.text}{"\u201D"}
              <span style={{
                fontSize: 11, color: "#8a7fa0", fontStyle: "normal",
                marginLeft: 6,
              }}>
                {"\u00B7"} {formatSimilarity(s.similarity)}
              </span>
            </p>

            {/* Emotion pills */}
            {s.emotions && s.emotions.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginTop: 6 }}>
                {s.emotions.map((e, ei) => {
                  const emoStr = typeof e === "string" ? e : String((e as any)?.label ?? (e as any)?.name ?? "");
                  const ec = EMOTION_COLORS[emoStr.toLowerCase()] ?? { bg: "rgba(138,127,160,0.10)", color: "#8a7fa0" };
                  return (
                    <span key={`${ei}:${emoStr}`} style={{
                      fontSize: 10, fontWeight: 500, padding: "2px 8px",
                      borderRadius: 99, background: ec.bg, color: ec.color,
                      letterSpacing: "0.03em",
                    }}>
                      {emoStr}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        fontSize: 11, color: "#8a7fa0", marginTop: 12,
        paddingTop: 10, borderTop: "1px solid rgba(155,143,184,0.12)",
      }}>
        From 86,000+ dreams in the community archive
      </div>
    </div>
  );
}
