interface Props {
  month: string;
  data: number[][];
}

const LEVEL_COLORS: Record<number, string> = {
  0: "rgba(107,95,165,0.04)",
  1: "rgba(107,95,165,0.15)",
  2: "rgba(107,95,165,0.30)",
  3: "rgba(107,95,165,0.50)",
  4: "rgba(107,95,165,0.75)",
};

const DAY_LABELS = ["M", "", "W", "", "F", "", ""];

export default function HeatmapCalendar({ month, data }: Props) {
  if (!Array.isArray(data) || data.length === 0 || !Array.isArray(data[0])) return null;

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
      <div style={questionLabel}>When do you dream most?</div>

      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 20,
          fontWeight: 600,
          color: "#2d2640",
          lineHeight: 1.2,
          marginBottom: 12,
        }}
      >
        {month}
      </div>

      <div style={{ display: "flex", gap: 3 }}>
        {/* Day labels column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            marginRight: 4,
          }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 12,
                fontSize: 9,
                color: "#8a7fa0",
                display: "flex",
                alignItems: "center",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        {data[0]?.map((_, colIdx) => (
          <div
            key={colIdx}
            style={{ display: "flex", flexDirection: "column", gap: 3 }}
          >
            {data.map((row, rowIdx) => (
              <div
                key={rowIdx}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background:
                    LEVEL_COLORS[row[colIdx] ?? 0] ?? LEVEL_COLORS[0],
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 14,
        }}
      >
        <span style={{ fontSize: 10, color: "#8a7fa0", marginRight: 2 }}>
          Less
        </span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: LEVEL_COLORS[level],
            }}
          />
        ))}
        <span style={{ fontSize: 10, color: "#8a7fa0", marginLeft: 2 }}>
          More
        </span>
      </div>
    </div>
  );
}
