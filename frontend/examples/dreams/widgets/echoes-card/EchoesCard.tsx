const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');
`;

interface Echo { date: string; title: string; text: string }
interface Props { echoes: Echo[] | string; source_chunk_ids?: string[] }

function parseEchoes(raw: unknown): Echo[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw.replace(/'/g, '"')); } catch { return []; }
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
  boxShadow: "0 2px 20px rgba(80,68,100,0.05), inset 0 1px 0 rgba(255,255,255,0.7)",
  padding: "24px 26px",
  display: "flex",
  flexDirection: "column" as const,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  overflow: "hidden",
};

export default function EchoesCard({ echoes: rawEchoes }: Props) {
  const echoes = parseEchoes(rawEchoes);

  return (
    <div style={container}>
      <style>{FONTS}</style>

      {/* Question label */}
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
        textTransform: "uppercase" as const, color: "#9b8fb8", marginBottom: 10,
      }}>
        Have you dreamed this before?
      </div>

      {/* Section title */}
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 20, fontWeight: 600, color: "#2d2640",
        lineHeight: 1.2, marginBottom: 14,
      }}>
        Your Dream Thread
      </div>

      {echoes.length === 0 ? (
        /* Empty state */
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <p style={{
            fontSize: 13, lineHeight: 1.7, color: "#8a7fa0",
            fontStyle: "italic", textAlign: "center" as const, margin: 0,
          }}>
            This is your first dream with these themes
          </p>
        </div>
      ) : (
        /* Timeline */
        <div style={{
          flex: 1, minHeight: 0, overflowY: "auto" as const,
          position: "relative" as const, paddingLeft: 20,
        }}>
          {/* Vertical timeline line */}
          <div style={{
            position: "absolute" as const, left: 5, top: 4, bottom: 4,
            width: 2, background: "rgba(155,143,184,0.18)", borderRadius: 1,
          }} />

          {echoes.map((e, i) => (
            <div key={`${e.date}-${i}`} style={{
              position: "relative" as const,
              marginBottom: i < echoes.length - 1 ? 16 : 0,
            }}>
              {/* Timeline dot */}
              <div style={{
                position: "absolute" as const, left: -20, top: 3,
                width: 12, height: 12, borderRadius: "50%",
                background: "#fff",
                border: "2px solid #6b5fa5",
                boxSizing: "border-box" as const,
              }} />

              {/* Date */}
              <div style={{ fontSize: 11, color: "#8a7fa0", marginBottom: 2 }}>
                {e.date}
              </div>

              {/* Title */}
              <div style={{
                fontSize: 13, fontWeight: 500, color: "#2d2640",
                marginBottom: 3,
              }}>
                {e.title}
              </div>

              {/* Text snippet with ellipsis */}
              <div style={{
                fontSize: 13, lineHeight: 1.7, color: "#524a65",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }}>
                {e.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
