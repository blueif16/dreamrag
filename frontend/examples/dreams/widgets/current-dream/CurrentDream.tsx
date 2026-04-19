interface Props {
  title: string;
  quote: string;
  meaning: string;
  subconscious_emotion: string;
  life_echo: string;
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

const titleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 20,
  fontWeight: 600,
  color: "#2d2640",
  lineHeight: 1.2,
  marginBottom: 14,
};

const quoteBlock: React.CSSProperties = {
  borderLeft: "2px solid rgba(107,95,165,0.2)",
  padding: "12px 16px",
  fontSize: 13,
  lineHeight: 1.7,
  color: "#524a65",
  fontWeight: 400,
  fontStyle: "italic",
  background: "rgba(107,95,165,0.04)",
  borderRadius: "0 10px 10px 0",
  marginBottom: 18,
};

const interpretationStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: "#524a65",
  fontWeight: 400,
  marginBottom: 20,
  flex: 1,
};

const accentRow: React.CSSProperties = {
  display: "flex",
  gap: 16,
  marginTop: "auto",
};

const accentCard: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.5)",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.6)",
};

const accentLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  marginBottom: 4,
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const accentText: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.55,
  color: "#524a65",
  fontWeight: 400,
};

export default function CurrentDream({
  title,
  quote,
  meaning,
  subconscious_emotion,
  life_echo,
}: Props) {
  if (!meaning && !title) return null;

  return (
    <div style={container}>
      <div style={questionLabel}>What does this dream mean?</div>

      <div style={titleStyle}>{title}</div>

      {quote && <div style={quoteBlock}>{quote}</div>}

      {meaning && <div style={interpretationStyle}>{meaning}</div>}

      {(subconscious_emotion || life_echo) && (
        <div style={accentRow}>
          {subconscious_emotion && (
            <div style={accentCard}>
              <div style={{ ...accentLabel, color: "#c4899c" }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#c4899c",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                Emotional undercurrent
              </div>
              <div style={accentText}>{subconscious_emotion}</div>
            </div>
          )}
          {life_echo && (
            <div style={accentCard}>
              <div style={{ ...accentLabel, color: "#c9a55a" }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#c9a55a",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                Life connection
              </div>
              <div style={accentText}>{life_echo}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
