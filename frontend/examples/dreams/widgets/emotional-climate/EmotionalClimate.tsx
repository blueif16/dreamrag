export default function EmotionalClimate() {
  const emotions = [
    { label: "Gentle anxiety", pct: 38, color: "#5B6EAF" },
    { label: "Wonder", pct: 24, color: "#D4A853" },
    { label: "Peace", pct: 17, color: "#7BB89A" },
    { label: "Urgency", pct: 12, color: "#C4899C" },
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
        Emotional Climate
      </div>

      {/* Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {emotions.map((e) => (
          <div key={e.label}>
            {/* Label row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 500 }}>
                {e.label}
              </span>
              <span style={{ fontSize: 12, color: "#7a7a8e" }}>{e.pct}%</span>
            </div>
            {/* Bar */}
            <div
              style={{
                height: 8,
                background: "rgba(238,234,255,0.4)",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${e.pct}%`,
                  height: "100%",
                  background: e.color,
                  borderRadius: 99,
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
