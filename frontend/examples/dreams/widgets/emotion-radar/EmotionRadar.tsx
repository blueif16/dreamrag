interface Axis { label: string; value: number }
interface Props { axes: Axis[] }

export default function EmotionRadar({ axes }: Props) {
  const cx = 120;
  const cy = 115;
  const maxR = 80;
  const levels = [0.25, 0.5, 0.75, 1.0];

  function polarToXY(index: number, radius: number) {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }

  function hexagonPoints(radius: number) {
    return axes.map((_, i) => { const p = polarToXY(i, radius); return `${p.x},${p.y}`; }).join(" ");
  }

  const dataPoints = axes.map((a, i) => polarToXY(i, a.value * maxR));
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const topAxis = axes[0] ?? { label: "", value: 0 };

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
      <div style={{
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#5B6EAF",
        marginBottom: 10,
      }}>
        Emotional Current
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox="0 0 240 230" width="100%" height="100%">
          {levels.map((l) => (
            <polygon key={l} points={hexagonPoints(maxR * l)} fill="none" stroke="rgba(91,110,175,0.10)" strokeWidth={1} />
          ))}
          {axes.map((_, i) => {
            const p = polarToXY(i, maxR);
            return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(91,110,175,0.08)" strokeWidth={1} />;
          })}
          <polygon points={dataPolygon} fill="rgba(91,110,175,0.3)" stroke="#5B6EAF" strokeWidth={1.5} />
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill="#5B6EAF" stroke="#fff" strokeWidth={1.5} />
          ))}
          {axes.map((a, i) => {
            const p = polarToXY(i, maxR + 18);
            return (
              <text key={a.label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fill="#7a7a8e" fontFamily="'DM Sans', system-ui, sans-serif">
                {a.label}
              </text>
            );
          })}
          <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
            fontFamily="'Playfair Display', Georgia, serif" fontSize={18} fontWeight={700} fill="#1a1a2e">
            {Math.round(topAxis.value * 100)}%
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#7a7a8e" fontFamily="'DM Sans', system-ui, sans-serif">
            {topAxis.label.toLowerCase()}
          </text>
        </svg>
      </div>
    </div>
  );
}
