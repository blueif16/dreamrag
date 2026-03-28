export default function SourcesPanel() {
  const sources = [
    {
      title: "Hall / Van de Castle coding manual",
      note: "Used for recurring element patterns.",
    },
    {
      title: "DreamBank community records",
      note: "Used for similar water-and-childhood dreams.",
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
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "'DM Sans', system-ui, sans-serif",
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
        }}
      >
        Reading Trail
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 20,
          fontWeight: 700,
          color: "#1a1a2e",
          lineHeight: 1.2,
        }}
      >
        Behind this reading.
      </div>

      {/* Source items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sources.map((s) => (
          <div
            key={s.title}
            style={{
              background: "rgba(238,234,255,0.35)",
              borderLeft: "3px solid #5B6EAF",
              borderRadius: "0 10px 10px 0",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#1a1a2e",
                marginBottom: 4,
              }}
            >
              {s.title}
            </div>
            <div style={{ fontSize: 12, color: "#7a7a8e", lineHeight: 1.4 }}>
              {s.note}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
