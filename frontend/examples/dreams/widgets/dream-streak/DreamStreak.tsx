export default function DreamStreak() {
  // Last 7 days: true = recorded, false = missed
  const last7 = [true, true, true, false, true, true, true];

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
        justifyContent: "space-between",
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
          marginBottom: 8,
        }}
      >
        Dream Streak
      </div>

      {/* Big number */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 44,
            fontWeight: 700,
            color: "#1a1a2e",
            lineHeight: 1,
          }}
        >
          27
        </span>
        <span style={{ fontSize: 16, color: "#7a7a8e", fontWeight: 400 }}>
          days
        </span>
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 12,
          color: "#7a7a8e",
          marginTop: 4,
          lineHeight: 1.4,
        }}
      >
        Recorded nearly every day.
      </div>

      {/* Sparkline dots */}
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {last7.map((active, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: active
                ? "#5B6EAF"
                : "rgba(238,234,255,0.5)",
              border: active
                ? "none"
                : "1px solid rgba(91,110,175,0.2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
