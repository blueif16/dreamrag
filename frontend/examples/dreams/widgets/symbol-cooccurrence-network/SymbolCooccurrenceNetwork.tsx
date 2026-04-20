const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');
`;

const DOTS = ["#6b5fa5", "#c4899c", "#c9a55a", "#7d9a6e", "#5b9dad", "#8b7fb8"];

interface Node { label: string; weight: number }
interface Props { center_symbol: string; nodes: Node[] | string }

function parseNodes(raw: unknown): Node[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw.replace(/'/g, '"')); } catch { return []; }
  }
  return [];
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
  textTransform: "uppercase" as const,
  color: "#9b8fb8",
  marginBottom: 10,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 26,
  fontWeight: 600,
  color: "#2d2640",
  lineHeight: 1.2,
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#8a7fa0",
  marginTop: 4,
  marginBottom: 16,
};

const listContainer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  flex: 1,
  minHeight: 0,
  overflowY: "auto" as const,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "#2d2640",
  minWidth: 90,
  flexShrink: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

const barTrack: React.CSSProperties = {
  flex: 1,
  height: 6,
  background: "rgba(107,95,165,0.06)",
  borderRadius: 3,
  overflow: "hidden",
};

const pctStyle: React.CSSProperties = {
  width: 36,
  fontSize: 11,
  color: "#8a7fa0",
  fontWeight: 500,
  textAlign: "right" as const,
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};

export default function SymbolCooccurrenceNetwork({
  center_symbol,
  nodes: rawNodes,
}: Props) {
  const nodes = parseNodes(rawNodes);
  if (!nodes.length) return null;

  const sorted = [...nodes].sort((a, b) => b.weight - a.weight);
  const maxWeight = Math.max(...sorted.map((n) => n.weight), 0.0001);

  return (
    <div style={container}>
      <style>{FONTS}</style>

      <div style={questionLabel}>What appears alongside this symbol?</div>

      <h2 style={titleStyle}>{center_symbol}</h2>
      <div style={subtitleStyle}>
        {sorted.length} symbol{sorted.length === 1 ? "" : "s"} co-occur, ranked by frequency
      </div>

      <div style={listContainer}>
        {sorted.map((n, i) => {
          const color = DOTS[i % DOTS.length];
          const fillPct = (n.weight / maxWeight) * 100;
          return (
            <div key={`${i}:${n?.label ?? ""}`} style={rowStyle}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={labelStyle}>{n.label}</span>
              <div style={barTrack}>
                <div
                  style={{
                    height: "100%",
                    width: `${fillPct}%`,
                    background: color,
                    borderRadius: 3,
                    opacity: 0.55,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <span style={pctStyle}>{Math.round(n.weight * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
