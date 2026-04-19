interface Cooc {
  label: string;
  count: number;
}

interface Props {
  symbol: string;
  count: number;
  window: string;
  cooccurrences: Cooc[];
}

export default function TopSymbol({
  symbol,
  count,
  window: windowLabel,
  cooccurrences,
}: Props) {
  if (!symbol) return null;

  const safeCoocs = Array.isArray(cooccurrences) ? cooccurrences : [];

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
      <div style={questionLabel}>What symbol dominates?</div>

      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 28,
          fontWeight: 600,
          color: "#2d2640",
          lineHeight: 1.2,
          textTransform: "capitalize",
          marginBottom: 6,
        }}
      >
        {symbol}
      </div>

      <div
        style={{
          fontSize: 13,
          color: "#524a65",
          lineHeight: 1.7,
          marginBottom: 2,
        }}
      >
        Appeared{" "}
        <span
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {count}
        </span>{" "}
        times
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#8a7fa0",
          marginBottom: 14,
        }}
      >
        in the {windowLabel}
      </div>

      {safeCoocs.length > 0 && (
        <div>
          <span
            style={{
              fontSize: 12,
              color: "#8a7fa0",
              marginRight: 8,
            }}
          >
            Often appears with:
          </span>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 6,
            }}
          >
            {safeCoocs.map((c) => (
              <span
                key={c.label}
                style={{
                  background: "rgba(107,95,165,0.06)",
                  border: "1px solid rgba(107,95,165,0.12)",
                  color: "#524a65",
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: 99,
                  textTransform: "capitalize",
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
