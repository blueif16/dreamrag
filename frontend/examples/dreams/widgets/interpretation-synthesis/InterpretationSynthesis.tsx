const SOURCE_STYLES = {
  personal: {
    border: "#6b5fa5",
    label: "From your dreams",
    bg: "rgba(107,95,165,0.06)",
  },
  textbook: {
    border: "#c9a55a",
    label: "From psychology",
    bg: "rgba(201,165,90,0.06)",
  },
  community: {
    border: "#c4899c",
    label: "From dream community",
    bg: "rgba(196,137,156,0.06)",
  },
} as const;

type SourceKey = keyof typeof SOURCE_STYLES;

interface Paragraph {
  text: string;
  source: SourceKey;
}

interface Props {
  symbol: string;
  subtitle: string;
  paragraphs: Paragraph[];
  source_chunk_ids?: string[];
}

function parseParagraphs(raw: unknown): Paragraph[] {
  if (Array.isArray(raw)) return raw.filter((p) => p && p.text);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed.replace(/'/g, '"'));
      if (Array.isArray(parsed)) return parsed.filter((p) => p && p.text);
    } catch {
      /* not JSON */
    }
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

const symbolTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 26,
  fontWeight: 600,
  color: "#2d2640",
  lineHeight: 1.2,
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 15,
  fontStyle: "italic",
  color: "#8a7fa0",
  margin: "4px 0 0",
};

const divider: React.CSSProperties = {
  height: 1,
  background:
    "linear-gradient(90deg, rgba(107,95,165,0.15), rgba(201,165,90,0.1), transparent)",
  margin: "16px 0",
  border: "none",
};

const paragraphList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  flex: 1,
  minHeight: 0,
  overflowY: "auto" as const,
};

const sourceLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  marginBottom: 4,
};

const bodyText: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: "#524a65",
  fontWeight: 400,
  margin: 0,
};

const legendRow: React.CSSProperties = {
  marginTop: 18,
  paddingTop: 12,
  borderTop: "1px solid rgba(107,95,165,0.08)",
  display: "flex",
  gap: 18,
  flexWrap: "wrap" as const,
};

const legendItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  color: "#8a7fa0",
};

export default function InterpretationSynthesis({
  symbol,
  subtitle,
  paragraphs: rawParagraphs,
}: Props) {
  const paragraphs = parseParagraphs(rawParagraphs);
  if (!symbol && !paragraphs.length) return null;

  return (
    <div style={container}>
      <div style={questionLabel}>
        What does {symbol || "this symbol"} mean?
      </div>

      <h2 style={symbolTitle}>{symbol}</h2>
      {subtitle && <p style={subtitleStyle}>{subtitle}</p>}

      <div style={divider} />

      <div style={paragraphList}>
        {paragraphs.map((p, i) => {
          const src = SOURCE_STYLES[p.source] ?? SOURCE_STYLES.personal;
          return (
            <div
              key={i}
              style={{
                borderLeft: `3px solid ${src.border}`,
                paddingLeft: 14,
                paddingTop: 2,
                paddingBottom: 2,
              }}
            >
              <div style={{ ...sourceLabel, color: src.border }}>
                {src.label}
              </div>
              <p style={bodyText}>{p.text}</p>
            </div>
          );
        })}
      </div>

      <div style={legendRow}>
        {Object.entries(SOURCE_STYLES).map(([key, s]) => (
          <div key={key} style={legendItem}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: s.border,
                display: "inline-block",
              }}
            />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
