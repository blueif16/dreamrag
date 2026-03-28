interface Echo { date: string; title: string; text: string }
interface Props { echoes: Echo[] }

export default function EchoesCard({ echoes }: Props) {
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
        gap: 12,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5B6EAF" }}>
        Echoes
      </div>

      {echoes.map((e) => (
        <div key={e.date} style={{
          background: "rgba(255,255,255,0.5)",
          borderRadius: 12,
          padding: "14px 16px",
          border: "1px solid rgba(91,110,175,0.10)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "#C4899C", fontWeight: 500 }}>{e.date}</span>
            <span style={{ fontSize: 10, color: "#bbb" }}>&middot;</span>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>
              {e.title}
            </span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: "#7a7a8e", fontWeight: 300 }}>
            {e.text}
          </div>
        </div>
      ))}
    </div>
  );
}
