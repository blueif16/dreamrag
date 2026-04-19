interface Props {
  center_symbol: string;
  satellites: string[];
}

const DOTS = ["#6b5fa5", "#c4899c", "#c9a55a", "#7d9a6e"];

function parseSatellites(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "[]") return [];
    if (trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed.replace(/'/g, '"'));
      } catch {
        /* fall through */
      }
    }
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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
  textTransform: "uppercase",
  color: "#9b8fb8",
  marginBottom: 10,
};

const centerSymbolStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 28,
  fontWeight: 600,
  color: "#2d2640",
  lineHeight: 1.2,
  marginBottom: 18,
};

const listContainer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  flex: 1,
  minHeight: 0,
  overflowY: "auto" as const,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const symbolName: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#2d2640",
  minWidth: 80,
  flexShrink: 0,
};

const barTrack: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: "rgba(107,95,165,0.06)",
  borderRadius: 2,
  overflow: "hidden",
};

const metaLine: React.CSSProperties = {
  fontSize: 11,
  color: "#8a7fa0",
  marginTop: 14,
};

export default function DreamAtmosphere({
  center_symbol,
  satellites: rawSatellites,
}: Props) {
  const satellites = parseSatellites(rawSatellites);
  if (!satellites.length) return null;

  return (
    <div style={container}>
      <div style={questionLabel}>What symbols appeared?</div>

      <div style={centerSymbolStyle}>{center_symbol}</div>

      <div style={listContainer}>
        {satellites.map((label, i) => {
          const dotColor = DOTS[i % DOTS.length];
          return (
            <div key={label} style={rowStyle}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: dotColor,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={symbolName}>{label}</span>
              <div style={barTrack}>
                <div
                  style={{
                    width: `${70 + ((i * 17) % 30)}%`,
                    height: "100%",
                    background: dotColor,
                    borderRadius: 2,
                    opacity: 0.45,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={metaLine}>Symbols extracted from dream analysis</div>
    </div>
  );
}
