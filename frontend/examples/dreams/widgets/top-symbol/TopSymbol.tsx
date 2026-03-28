interface Cooc { label: string; count: number }
interface Props {
  symbol: string;
  count: number;
  window: string;
  cooccurrences: Cooc[];
}

export default function TopSymbol({ symbol, count, window, cooccurrences }: Props) {
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
        gap: 10,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5B6EAF" }}>
        Top Symbol
      </div>

      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 700, color: "#1a1a2e", lineHeight: 1 }}>
        {symbol}
      </div>

      <div style={{ fontSize: 12, color: "#7a7a8e", lineHeight: 1.4 }}>
        {count} in the {window}.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        {cooccurrences.map((p) => (
          <span key={p.label} style={{
            background: "rgba(238,234,255,0.5)",
            color: "#5B6EAF",
            fontSize: 11,
            fontWeight: 500,
            padding: "4px 10px",
            borderRadius: 99,
          }}>
            {p.label} &times; {p.count}
          </span>
        ))}
      </div>
    </div>
  );
}
