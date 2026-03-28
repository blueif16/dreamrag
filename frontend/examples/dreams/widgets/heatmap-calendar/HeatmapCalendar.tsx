interface Props {
  month: string;
  data: number[][];
}

const levelColors: Record<number, string> = {
  0: "rgba(238,234,255,0.3)",
  1: "rgba(91,110,175,0.2)",
  2: "rgba(91,110,175,0.4)",
  3: "rgba(91,110,175,0.6)",
  4: "rgba(91,110,175,0.85)",
};

const dayLabels = ["M", "", "W", "", "F", "", ""];

export default function HeatmapCalendar({ month, data }: Props) {
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
        padding: "20px 22px",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5B6EAF", marginBottom: 12 }}>
        Dream Frequency
      </div>
      <div style={{ fontSize: 11, color: "#7a7a8e", marginBottom: 8 }}>{month}</div>

      <div style={{ display: "flex", gap: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 4 }}>
          {dayLabels.map((label, i) => (
            <div key={i} style={{ width: 14, height: 14, fontSize: 9, color: "#aaa", display: "flex", alignItems: "center" }}>
              {label}
            </div>
          ))}
        </div>

        {data[0]?.map((_, colIdx) => (
          <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {data.map((row, rowIdx) => (
              <div key={rowIdx} style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: levelColors[row[colIdx] ?? 0] ?? levelColors[0],
              }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
