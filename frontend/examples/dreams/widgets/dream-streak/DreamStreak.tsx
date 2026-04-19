interface Props {
  streak: number;
  last7: boolean[];
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function getMessage(streak: number): string {
  if (streak >= 7) return "You\u2019re building a powerful habit";
  if (streak >= 3) return "Keep the momentum going";
  if (streak >= 1) return "Every dream recorded matters";
  return "Start your streak tonight";
}

export default function DreamStreak({ streak, last7 }: Props) {
  const safeStreak = typeof streak === "number" ? streak : 0;
  const safeLast7 = Array.isArray(last7)
    ? last7.slice(0, 7)
    : Array(7).fill(false);

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

  return (
    <div style={container}>
      <div style={questionLabel}>How consistent are you?</div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 48,
            fontWeight: 600,
            color: "#2d2640",
            lineHeight: 1,
          }}
        >
          {safeStreak}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#8a7fa0",
          marginTop: 2,
          marginBottom: 16,
        }}
      >
        days
      </div>

      <div>
        <div style={{ display: "flex", gap: 4 }}>
          {safeLast7.map((active: boolean, i: number) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                background: active ? "#6b5fa5" : "transparent",
                border: active
                  ? "1px solid #6b5fa5"
                  : "1px solid rgba(107,95,165,0.2)",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                width: 16,
                fontSize: 9,
                color: "#8a7fa0",
                textAlign: "center",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          fontSize: 13,
          color: "#524a65",
          lineHeight: 1.7,
          marginTop: 14,
          fontStyle: "italic",
        }}
      >
        {getMessage(safeStreak)}
      </div>
    </div>
  );
}
