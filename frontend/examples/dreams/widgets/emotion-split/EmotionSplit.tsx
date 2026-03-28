const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
`;

const PALETTE = ["#5B6EAF", "#7BB89A", "#C4899C", "#D4A853", "#7B68C8", "#8BBCCC"];

interface Slice { label: string; value: number }
interface Props { symbol: string; symbol_emotions: Slice[]; overall_emotions: Slice[] }

function buildArcs(slices: Slice[], cx: number, cy: number, r: number, gap = 0.04) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  let angle = -Math.PI / 2;
  return slices.map((sl, i) => {
    const sweep = (sl.value / total) * (Math.PI * 2) - gap;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    angle += sweep + gap;
    return { ...sl, d, color: PALETTE[i % PALETTE.length] };
  });
}

function Donut({ slices, cx, cy, r, label }: { slices: Slice[]; cx: number; cy: number; r: number; label: string }) {
  const arcs = buildArcs(slices, cx, cy, r);
  const innerR = r * 0.62;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(238,234,255,0.5)" strokeWidth={r - innerR} />
      {arcs.map((arc) => (
        <path key={arc.label} d={arc.d} fill="none" stroke={arc.color} strokeWidth={r - innerR} strokeLinecap="round" opacity={0.88} />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        fontFamily="'Playfair Display', Georgia, serif" fontSize={9} fontWeight={600} fill="#1a1a2e">
        {label.split(" ").map((word, i) => (
          <tspan key={i} x={cx} dy={i === 0 ? 0 : 11}>{word}</tspan>
        ))}
      </text>
    </g>
  );
}

export default function EmotionSplit({ symbol, symbol_emotions, overall_emotions }: Props) {
  const legendSlices = symbol_emotions.map((sl, i) => ({ ...sl, color: PALETTE[i % PALETTE.length] }));

  return (
    <div style={{
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
    }}>
      <style>{FONTS}</style>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4899C", marginBottom: 3 }}>
          Emotion Split
        </div>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>
          {symbol} vs. all dreams
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox="0 0 240 160" width="100%" height="100%">
          <Donut slices={symbol_emotions}  cx={68}  cy={80} r={52} label={`${symbol} dreams`} />
          <Donut slices={overall_emotions} cx={176} cy={80} r={52} label="All dreams" />
        </svg>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8 }}>
        {legendSlices.map((sl) => (
          <div key={sl.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: sl.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#6a6a7a" }}>{sl.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
