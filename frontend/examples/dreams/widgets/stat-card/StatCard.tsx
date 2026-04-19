interface Props {
  label: string;
  personal: number;
  baseline: number;
  description: string;
}

export default function StatCard({
  label,
  personal,
  baseline,
  description,
}: Props) {
  const safePersnal = typeof personal === "number" ? personal : 0;
  const safeBaseline = typeof baseline === "number" ? baseline : 0;
  const diff = safePersnal - safeBaseline;
  const absDiff = Math.abs(Math.round(diff));

  let deviationText: string;
  let deviationColor: string;

  if (diff > 2) {
    deviationText = `+${absDiff}% above average`;
    deviationColor = "#7d9a6e";
  } else if (diff < -2) {
    deviationText = `${absDiff}% below average`;
    deviationColor = "#c4899c";
  } else {
    deviationText = "Right at the average";
    deviationColor = "#8a7fa0";
  }

  const container: React.CSSProperties = {
    width: "100%",
    height: "100%",
    background: "rgba(255,255,255,0.55)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.65)",
    boxShadow:
      "0 2px 20px rgba(80,68,100,0.05), inset 0 1px 0 rgba(255,255,255,0.7)",
    padding: "24px 26px",
    display: "flex",
    flexDirection: "column" as const,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    overflow: "hidden",
  };

  const questionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#9b8fb8",
    marginBottom: 10,
  };

  const barTrack: React.CSSProperties = {
    width: "100%",
    height: 8,
    borderRadius: 4,
    background: "rgba(107,95,165,0.06)",
    overflow: "hidden",
  };

  return (
    <div style={container}>
      <div style={questionLabel}>How do you compare?</div>

      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 20,
          fontWeight: 600,
          color: "#2d2640",
          lineHeight: 1.2,
          marginBottom: 16,
        }}
      >
        {label}
      </div>

      {/* You bar */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 5,
          }}
        >
          <span style={{ fontSize: 12, color: "#524a65", fontWeight: 500 }}>
            You
          </span>
          <span
            style={{
              fontSize: 12,
              color: "#6b5fa5",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {safePersnal}%
          </span>
        </div>
        <div style={barTrack}>
          <div
            style={{
              width: `${Math.min(safePersnal, 100)}%`,
              height: "100%",
              borderRadius: 4,
              background: "#6b5fa5",
              opacity: 0.85,
            }}
          />
        </div>
      </div>

      {/* Average bar */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 5,
          }}
        >
          <span style={{ fontSize: 12, color: "#524a65", fontWeight: 500 }}>
            Average
          </span>
          <span
            style={{
              fontSize: 12,
              color: "#c4899c",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {safeBaseline}%
          </span>
        </div>
        <div style={barTrack}>
          <div
            style={{
              width: `${Math.min(safeBaseline, 100)}%`,
              height: "100%",
              borderRadius: 4,
              background: "#c4899c",
              opacity: 0.85,
            }}
          />
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: "#524a65",
          marginBottom: 10,
        }}
      >
        {description}
      </div>

      {/* Deviation badge */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: deviationColor,
        }}
      >
        {deviationText}
      </div>
    </div>
  );
}
