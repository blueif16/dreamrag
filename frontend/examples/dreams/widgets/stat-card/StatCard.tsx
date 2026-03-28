const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
`;

export default function StatCard() {
  const personal = 31;
  const baseline = 12;
  const pct = Math.round(((personal - baseline) / baseline) * 100);

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
        justifyContent: "space-between",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <style>{FONTS}</style>

      <div>
        <div style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#5B6EAF",
          marginBottom: 8,
        }}>
          Water Frequency
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 44,
            fontWeight: 700,
            color: "#1a1a2e",
            lineHeight: 1,
          }}>
            {personal}%
          </span>
          <span style={{
            fontSize: 12,
            color: "#5B6EAF",
            fontWeight: 500,
            background: "rgba(91,110,175,0.10)",
            padding: "2px 7px",
            borderRadius: 99,
            marginLeft: 4,
          }}>
            +{pct}% vs norm
          </span>
        </div>

        <div style={{
          fontSize: 12,
          color: "#7a7a8e",
          marginTop: 4,
          lineHeight: 1.4,
        }}>
          of your dreams feature water
        </div>
      </div>

      {/* Comparison bar */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#aaa", marginBottom: 5 }}>
          <span>You</span>
          <span>DreamBank avg</span>
        </div>
        <div style={{
          height: 6,
          background: "rgba(238,234,255,0.5)",
          borderRadius: 99,
          overflow: "hidden",
          position: "relative",
        }}>
          {/* Baseline */}
          <div style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: `${baseline}%`,
            background: "rgba(196,137,156,0.35)",
            borderRadius: 99,
          }} />
          {/* Personal */}
          <div style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: `${personal}%`,
            background: "linear-gradient(90deg, #5B6EAF, #7B68C8)",
            borderRadius: 99,
            opacity: 0.85,
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#aaa", marginTop: 4 }}>
          <span style={{ color: "#5B6EAF", fontWeight: 500 }}>{personal}%</span>
          <span>{baseline}%</span>
        </div>
      </div>
    </div>
  );
}
