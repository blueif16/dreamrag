"use client";

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
`;

const PALETTE = { indigo: "#5B6EAF" };

const BADGE = {
  personal:  { label: "Personal",  bg: "#EEEAFF", color: "#5B6EAF" },
  textbook:  { label: "Textbook",  bg: "#FFF4E0", color: "#D4A853" },
  community: { label: "Community", bg: "#FDEEF3", color: "#C4899C" },
} as const;

type BadgeKey = keyof typeof BADGE;

interface Paragraph { text: string; source: BadgeKey }
interface Props { symbol: string; subtitle: string; paragraphs: Paragraph[] }

function SourceBadge({ type }: { type: BadgeKey }) {
  const b = BADGE[type] ?? BADGE.personal;
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 500, letterSpacing: "0.06em",
      textTransform: "uppercase", padding: "2px 8px", borderRadius: 99,
      background: b.bg, color: b.color, marginRight: 8, verticalAlign: "middle",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {b.label}
    </span>
  );
}

export default function InterpretationSynthesis({ symbol, subtitle, paragraphs }: Props) {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "linear-gradient(135deg, rgba(238,234,255,0.7) 0%, rgba(255,249,242,0.7) 100%)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderRadius: 20,
      border: "1px solid rgba(255,255,255,0.75)",
      boxShadow: "0 4px 32px rgba(91,110,175,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
      padding: "28px 32px",
      display: "flex",
      flexDirection: "column",
      gap: 0,
      overflow: "hidden",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{FONTS}</style>

      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: PALETTE.indigo, opacity: 0.7, marginBottom: 6 }}>
          Interpretation Synthesis
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.25, margin: 0 }}>
          {symbol}
        </h2>
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontStyle: "italic", color: PALETTE.indigo, margin: "4px 0 0" }}>
          {subtitle}
        </p>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, rgba(91,110,175,0.25), rgba(212,168,83,0.15), transparent)", margin: "16px 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 18, overflowY: "auto", flex: 1 }}>
        {paragraphs.map((p, i) => (
          <div key={i}>
            <SourceBadge type={p.source} />
            <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.7, color: "#2d2d3a" }}>{p.text}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid rgba(91,110,175,0.12)", display: "flex", gap: 16, flexWrap: "wrap" }}>
        {Object.entries(BADGE).map(([key, b]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b6b7e" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, display: "inline-block" }} />
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
