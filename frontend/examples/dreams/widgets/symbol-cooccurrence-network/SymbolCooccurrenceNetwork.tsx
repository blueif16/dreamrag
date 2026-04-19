const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');
`;

const FADE_IN = `
  @keyframes coocFadeIn {
    from { opacity: 0; transform: scale(0.8); }
    to   { opacity: 1; transform: scale(1); }
  }
`;

interface Node { label: string; weight: number }
interface Props { center_symbol: string; nodes: Node[] | string }

function parseNodes(raw: unknown): Node[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw.replace(/'/g, '"')); } catch { return []; }
  }
  return [];
}

function nodeRadius(w: number): number { return 16 + w * 20; }

const CENTER_X = 200;
const CENTER_Y = 180;
const CENTER_R = 32;
const ORBIT_R = 120;

const container: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.65)",
  boxShadow: "0 2px 20px rgba(80,68,100,0.05), inset 0 1px 0 rgba(255,255,255,0.7)",
  padding: "24px 26px",
  display: "flex",
  flexDirection: "column" as const,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  overflow: "hidden",
};

export default function SymbolCooccurrenceNetwork({ center_symbol, nodes: rawNodes }: Props) {
  const nodes = parseNodes(rawNodes);
  if (!nodes.length) return null;

  const positioned = nodes.map((n, i) => {
    const angle = (Math.PI * 2 * i) / nodes.length - Math.PI / 2;
    return {
      ...n,
      x: CENTER_X + ORBIT_R * Math.cos(angle),
      y: CENTER_Y + ORBIT_R * Math.sin(angle),
    };
  });

  // Build the text list for below the SVG
  const sortedNodes = [...nodes].sort((a, b) => b.weight - a.weight);

  return (
    <div style={container}>
      <style>{FONTS}</style>
      <style>{FADE_IN}</style>

      {/* Question label */}
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
        textTransform: "uppercase" as const, color: "#9b8fb8", marginBottom: 10,
      }}>
        What appears alongside this symbol?
      </div>

      {/* Section title */}
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 20, fontWeight: 600, color: "#2d2640",
        lineHeight: 1.2, marginBottom: 14,
      }}>
        Symbol Network
      </div>

      {/* SVG network */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 400 360" width="100%" style={{ maxHeight: "100%" }}>
          {/* Connecting lines */}
          {positioned.map((n) => (
            <line
              key={`edge-${n.label}`}
              x1={CENTER_X} y1={CENTER_Y}
              x2={n.x} y2={n.y}
              stroke="rgba(107,95,165,0.2)"
              strokeWidth={1 + n.weight * 4}
              strokeLinecap="round"
            />
          ))}

          {/* Center node */}
          <circle
            cx={CENTER_X} cy={CENTER_Y} r={CENTER_R}
            fill="#6b5fa5"
          />
          <text
            x={CENTER_X} y={CENTER_Y + 1}
            textAnchor="middle" dominantBaseline="middle"
            fontFamily="'Cormorant Garamond', Georgia, serif"
            fontSize={13} fontWeight={600} fill="white"
          >
            {center_symbol}
          </text>

          {/* Satellite nodes */}
          {positioned.map((n, i) => {
            const r = nodeRadius(n.weight);
            return (
              <g
                key={n.label}
                style={{
                  animation: `coocFadeIn 0.4s ease both`,
                  animationDelay: `${i * 80}ms`,
                  transformOrigin: `${n.x}px ${n.y}px`,
                }}
              >
                <circle
                  cx={n.x} cy={n.y} r={r}
                  fill="rgba(238,234,255,0.6)"
                  stroke="rgba(107,95,165,0.2)"
                  strokeWidth={1}
                />
                <text
                  x={n.x} y={n.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fontFamily="'DM Sans', system-ui, sans-serif"
                  fontSize={10} fontWeight={500} fill="#2d2640"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Text list of connections */}
      <div style={{
        fontSize: 11, color: "#8a7fa0", lineHeight: 1.6,
        marginTop: 10, paddingTop: 10,
        borderTop: "1px solid rgba(155,143,184,0.12)",
      }}>
        {sortedNodes.map((n, i) => (
          <span key={n.label}>
            <span style={{ color: "#524a65", fontWeight: 500 }}>{n.label}</span>
            <span>{" "}({Math.round(n.weight * 100)}%)</span>
            {i < sortedNodes.length - 1 && <span> {"\u00B7"} </span>}
          </span>
        ))}
      </div>
    </div>
  );
}
