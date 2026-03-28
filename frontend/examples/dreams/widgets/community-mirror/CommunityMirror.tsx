const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
`;

const snippets = [
  {
    text: "Standing at the edge of an endless dark ocean, waves pulling at my feet. I wasn't afraid — just overwhelmed by how vast it felt.",
    emotions: ["awe", "calm"],
    similarity: 94,
  },
  {
    text: "Swimming underwater, completely at peace. The light filtered down in long pale columns. I could breathe somehow.",
    emotions: ["calm", "wonder"],
    similarity: 87,
  },
  {
    text: "A river kept rising around my childhood home. I was watching from the roof, not panicking, just watching it come.",
    emotions: ["anxiety", "nostalgia"],
    similarity: 81,
  },
];

const EMOTION_COLORS: Record<string, { bg: string; color: string }> = {
  awe:      { bg: "#EEEAFF", color: "#5B6EAF" },
  calm:     { bg: "#E8F5EE", color: "#4A8A65" },
  wonder:   { bg: "#FFF4E0", color: "#D4A853" },
  anxiety:  { bg: "#FDEEF3", color: "#C4899C" },
  nostalgia:{ bg: "#F3F0FF", color: "#7B68C8" },
};

export default function CommunityMirror() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(255,255,255,0.60)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.75)",
        boxShadow: "0 4px 24px rgba(91,110,175,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
        padding: "24px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        overflow: "hidden",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <style>{FONTS}</style>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#C4899C",
          marginBottom: 4,
        }}>
          Community Mirror
        </div>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 16,
          fontWeight: 600,
          color: "#1a1a2e",
        }}>
          Others who dreamed of water
        </div>
      </div>

      {/* Snippets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto" }}>
        {snippets.map((s, i) => (
          <div
            key={i}
            style={{
              background: "rgba(238,234,255,0.25)",
              borderRadius: 12,
              padding: "12px 14px",
              border: "1px solid rgba(238,234,255,0.6)",
            }}
          >
            {/* Similarity badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {s.emotions.map((e) => {
                  const style = EMOTION_COLORS[e] ?? { bg: "#f0f0f0", color: "#666" };
                  return (
                    <span
                      key={e}
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: "2px 7px",
                        borderRadius: 99,
                        background: style.bg,
                        color: style.color,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {e}
                    </span>
                  );
                })}
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#5B6EAF",
                background: "rgba(91,110,175,0.10)",
                padding: "2px 8px",
                borderRadius: 99,
              }}>
                {s.similarity}% match
              </div>
            </div>
            <p style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.65,
              color: "#3a3a4a",
              fontStyle: "italic",
            }}>
              &#8220;{s.text}&#8221;
            </p>
            <div style={{ marginTop: 6, fontSize: 10, color: "#aaa" }}>Anonymous · similar_to graph</div>
          </div>
        ))}
      </div>
    </div>
  );
}
