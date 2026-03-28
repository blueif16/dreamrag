export default function CurrentDream() {
  const panels = [
    {
      title: "Meaning",
      text: "Water feels emotional, not threatening. The house pulls the dream toward memory.",
    },
    {
      title: "Subconscious Emotion",
      text: "Gentle anxiety: searching, not defensive.",
    },
    {
      title: "Life Echo",
      text: "It often appears when identity or safety is shifting.",
    },
  ];

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
        fontFamily: "'DM Sans', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#5B6EAF",
          marginBottom: 8,
        }}
      >
        Current Dream
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 22,
          fontWeight: 700,
          color: "#1a1a2e",
          lineHeight: 1.25,
          marginBottom: 16,
        }}
      >
        Water under the old house.
      </div>

      {/* Dream quote block */}
      <div
        style={{
          background: "rgba(238,234,255,0.35)",
          borderRadius: 14,
          padding: "16px 18px",
          fontSize: 13,
          lineHeight: 1.65,
          color: "#4a4a5e",
          fontWeight: 300,
          marginBottom: 20,
          borderLeft: "3px solid rgba(91,110,175,0.25)",
        }}
      >
        Last night I dreamed I was walking through very deep water. Everything
        around me was quiet. I kept looking for the house I lived in as a child.
        I was not afraid. I only felt that I had to keep moving forward.
      </div>

      {/* Sub-panels row */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        {panels.map((p) => (
          <div
            key={p.title}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.55)",
              borderRadius: 12,
              padding: "14px 14px",
              display: "flex",
              flexDirection: "column",
              border: "1px solid rgba(255,255,255,0.7)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#5B6EAF",
                marginBottom: 6,
              }}
            >
              {p.title}
            </div>
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: "#5a5a6e",
                fontWeight: 300,
              }}
            >
              {p.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
