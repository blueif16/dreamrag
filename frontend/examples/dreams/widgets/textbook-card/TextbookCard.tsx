const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@300;400;500&display=swap');
`;

export default function TextbookCard() {
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
        boxShadow:
          "0 4px 24px rgba(91,110,175,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
        padding: "24px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        overflow: "hidden",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <style>{FONTS}</style>

      {/* Label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 3,
            height: 32,
            borderRadius: 2,
            background: "linear-gradient(180deg, #D4A853, #C4899C)",
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#D4A853",
              marginBottom: 2,
            }}
          >
            Textbook
          </div>
          <div
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 15,
              fontWeight: 600,
              color: "#1a1a2e",
              lineHeight: 1.2,
            }}
          >
            Water
          </div>
        </div>
      </div>

      {/* Excerpt */}
      <blockquote
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 14,
          lineHeight: 1.75,
          fontStyle: "italic",
          color: "#2d2d3a",
          margin: 0,
          padding: "14px 16px",
          background: "rgba(238,234,255,0.35)",
          borderRadius: 12,
          borderLeft: "3px solid rgba(212,168,83,0.5)",
          flex: 1,
        }}
      >
        &#8220;Water is the universal symbol of the unconscious: it represents the fluid,
        boundless realm of emotion, intuition, and hidden potential. Its depth suggests
        what lies beneath ordinary awareness — the submerged content of the psyche
        seeking to surface and be known.&#8221;
      </blockquote>

      {/* Citation */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#5B6EAF",
          }}
        >
          C.G. Jung
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#9090a0",
            lineHeight: 1.4,
          }}
        >
          The Archetypes and the Collective Unconscious, Vol. 9i
          <br />
          <span style={{ color: "#D4A853" }}>dream_knowledge</span> · symbolizes / interprets
        </div>
      </div>
    </div>
  );
}
