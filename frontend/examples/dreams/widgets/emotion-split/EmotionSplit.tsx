const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');
`;

const EMOTION_COLORS: Record<string, string> = {
  anxiety: "#c4899c",
  joy:     "#c9a55a",
  sadness: "#6b5fa5",
  anger:   "#d47a6b",
  fear:    "#8b7fb8",
  peace:   "#7d9a6e",
  wonder:  "#5b9dad",
  calm:    "#7d9a6e",
  awe:     "#5b9dad",
  nostalgia: "#8b7fb8",
  urgency: "#d47a6b",
};

const FALLBACK_COLORS = ["#c4899c", "#c9a55a", "#6b5fa5", "#d47a6b", "#8b7fb8", "#7d9a6e", "#5b9dad"];

interface Slice { label: string; value: number }
interface Props { symbol: string; symbol_emotions: Slice[] | string; overall_emotions: Slice[] | string }

function parseSlices(raw: unknown): Slice[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw.replace(/'/g, '"')); } catch { return []; }
  }
  return [];
}

function getColor(label: string, index: number): string {
  return EMOTION_COLORS[label.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

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

function BarRow({ label, value, maxValue, color }: { label: string; value: number; maxValue: number; color: string }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{
        width: 64, fontSize: 11, color: "#524a65", fontWeight: 400,
        textAlign: "right" as const, flexShrink: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
      }}>
        {label}
      </div>
      <div style={{
        flex: 1, height: 14, background: "rgba(155,143,184,0.08)",
        borderRadius: 7, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: 7, opacity: 0.75,
          transition: "width 0.4s ease",
        }} />
      </div>
      <div style={{
        width: 32, fontSize: 11, color: "#8a7fa0", fontWeight: 500,
        textAlign: "right" as const, flexShrink: 0,
      }}>
        {Math.round(value)}%
      </div>
    </div>
  );
}

export default function EmotionSplit({ symbol, symbol_emotions: rawSymbol, overall_emotions: rawOverall }: Props) {
  const symbolEmotions = parseSlices(rawSymbol);
  const overallEmotions = parseSlices(rawOverall);

  if (!symbolEmotions.length && !overallEmotions.length) return null;

  // Find max value for consistent bar scaling across both columns
  const allValues = [...symbolEmotions.map(s => s.value), ...overallEmotions.map(s => s.value)];
  const maxVal = Math.max(...allValues, 1);

  return (
    <div style={container}>
      <style>{FONTS}</style>

      {/* Question label */}
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
        textTransform: "uppercase" as const, color: "#9b8fb8", marginBottom: 10,
      }}>
        What emotions does this symbol carry?
      </div>

      {/* Section title */}
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 20, fontWeight: 600, color: "#2d2640",
        lineHeight: 1.2, marginBottom: 14,
      }}>
        {symbol}
      </div>

      {/* Two-column bar comparison */}
      <div style={{
        flex: 1, minHeight: 0, display: "flex", gap: 20,
        overflowY: "auto" as const,
      }}>
        {/* Left column: This symbol */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#2d2640",
            marginBottom: 10, letterSpacing: "0.02em",
          }}>
            This symbol
          </div>
          {symbolEmotions.map((sl, i) => (
            <BarRow
              key={sl.label}
              label={sl.label}
              value={sl.value}
              maxValue={maxVal}
              color={getColor(sl.label, i)}
            />
          ))}
        </div>

        {/* Divider */}
        <div style={{
          width: 1, background: "rgba(155,143,184,0.15)",
          alignSelf: "stretch" as const, flexShrink: 0,
        }} />

        {/* Right column: All your dreams */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#2d2640",
            marginBottom: 10, letterSpacing: "0.02em",
          }}>
            All your dreams
          </div>
          {overallEmotions.map((sl, i) => (
            <BarRow
              key={sl.label}
              label={sl.label}
              value={sl.value}
              maxValue={maxVal}
              color={getColor(sl.label, i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
