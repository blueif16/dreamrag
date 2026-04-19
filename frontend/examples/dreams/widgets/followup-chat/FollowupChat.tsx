interface Props {
  dream_title: string;
  prompts: string[] | string;
}

function parsePrompts(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "[]") return [];
    try { const parsed = JSON.parse(t); if (Array.isArray(parsed)) return parsed.filter(Boolean); } catch {}
    try { const parsed = JSON.parse(t.replace(/'/g, '"')); if (Array.isArray(parsed)) return parsed.filter(Boolean); } catch {}
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default function FollowupChat({ dream_title, prompts: rawPrompts }: Props) {
  const prompts = parsePrompts(rawPrompts);
  if (!prompts.length) return null;
  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>What to explore next?</div>
        <div style={titleStyle}>{dream_title}</div>
      </div>

      <div style={gridStyle}>
        {prompts.map((p) => (
          <div key={p} style={promptStyle}>
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "rgba(255,255,255,0.60)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow:
    "0 4px 24px rgba(91,110,175,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
  padding: "22px 24px 18px",
  display: "flex",
  flexDirection: "column",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  overflow: "hidden",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#9b8fb8",
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 18,
  fontWeight: 500,
  color: "#2d2640",
  lineHeight: 1.3,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
  alignItems: "stretch",
};

const promptStyle: React.CSSProperties = {
  background: "rgba(107,95,165,0.06)",
  border: "1px solid rgba(107,95,165,0.10)",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 12,
  color: "#524a65",
  cursor: "pointer",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontWeight: 400,
  lineHeight: 1.45,
  display: "flex",
  alignItems: "center",
  minHeight: 64,
  transition: "background 0.2s ease, border-color 0.2s ease",
};
