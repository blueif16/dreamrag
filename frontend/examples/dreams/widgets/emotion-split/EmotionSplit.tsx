const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
`;

interface Slice {
  label: string;
  value: number;
  color: string;
}

const SYMBOL_EMOTIONS: Slice[] = [
  { label: "Awe",      value: 38, color: "#5B6EAF" },
  { label: "Calm",     value: 29, color: "#7BB89A" },
  { label: "Anxiety",  value: 21, color: "#C4899C" },
  { label: "Wonder",   value: 12, color: "#D4A853" },
];

const OVERALL_EMOTIONS: Slice[] = [
  { label: "Awe",      value: 18, color: "#5B6EAF" },
  { label: "Calm",     value: 22, color: "#7BB89A" },
  { label: "Anxiety",  value: 35, color: "#C4899C" },
  { label: "Wonder",   value: 25, color: "#D4A853" },
];

function buildArcs(slices: Slice[], cx: number, cy: number, r: number, gap = 0.04) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  let angle = -Math.PI / 2;
  return slices.map((sl) => {
    const sweep = (sl.value / total) * (Math.PI * 2) - gap;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    angle += sweep + gap;
    return { ...sl, d };
  });
}

function Donut({ slices, cx, cy, r, label }: { slices: Slice[]; cx: number; cy: number; r: number; label: string }) {
  const arcs = buildArcs(slices, cx, cy, r);
  const innerR = r * 0.62;
  return (
    <g>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(238,234,255,0.5)" strokeWidth={r - innerR} />
      {/* Arcs */}
      {arcs.map((arc) => (
        <path
          key={arc.label}
          d={arc.d}
          fill="none"
          stroke={arc.color}
          strokeWidth={r - innerR}
          strokeLinecap="round"
          opacity={0.88}
        />
      ))}
      {/* Center label */}
      <text
        x={cx} y={cy - 4}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="'Playfair Display', Georgia, serif"
        fontSize={9} fontWeight={600} fill="#1a1a2e"
      >
        {label.split(" ").map((word, i) => (
          <tspan key={i} x={cx} dy={i === 0 ? 0 : 11}>{word}</tspan>
        ))}
      </text>
    </g>
  );
}

export default function EmotionSplit() {
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
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <style>{FONTS}</style>

      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#C4899C", marginBottom: 3,
        }}>
          Emotion Split
        </div>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 15, fontWeight: 600, color: "#1a1a2e",
        }}>
          Water vs. all dreams
        </div>
      </div>

      {/* Donuts */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox="0 0 240 160" width="100%" height="100%">
          <Donut slices={SYMBOL_EMOTIONS} cx={68}  cy={80} r={52} label="Water dreams" />
          <Donut slices={OVERALL_EMOTIONS} cx={176} cy={80} r={52} label="All dreams" />
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 14px",
        marginTop: 8,
      }}>
        {SYMBOL_EMOTIONS.map((sl) => (
          <div key={sl.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: sl.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: "#6a6a7a" }}>{sl.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
