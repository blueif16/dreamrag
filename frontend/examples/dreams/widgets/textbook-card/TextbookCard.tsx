const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');
`;

interface Props {
  symbol: string;
  excerpt: string;
  author: string;
  source: string;
  source_chunk_ids?: string[];
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

export default function TextbookCard({ excerpt, author, source }: Props) {
  if (!excerpt) return null;

  return (
    <div style={container}>
      <style>{FONTS}</style>

      {/* Question label */}
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
        textTransform: "uppercase" as const, color: "#9b8fb8", marginBottom: 10,
      }}>
        What does psychology say?
      </div>

      {/* Section title */}
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 20, fontWeight: 600, color: "#2d2640",
        lineHeight: 1.2, marginBottom: 14,
      }}>
        From the Archive
      </div>

      {/* Blockquote */}
      <blockquote style={{
        margin: 0, flex: 1, position: "relative" as const,
        padding: "16px 18px 16px 20px",
        borderLeft: "3px solid",
        borderImage: "linear-gradient(180deg, #c9a55a, rgba(201,165,90,0.3)) 1",
        background: "rgba(201,165,90,0.04)",
        borderRadius: "0 10px 10px 0",
      }}>
        {/* Decorative opening quote */}
        <span style={{
          position: "absolute" as const, top: 8, left: 8,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 28, fontWeight: 600, color: "#c9a55a",
          lineHeight: 1, opacity: 0.7, userSelect: "none" as const,
        }}>
          {"\u201C"}
        </span>

        <p style={{
          margin: 0, paddingTop: 14,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 14, lineHeight: 1.75, fontStyle: "italic",
          color: "#524a65",
        }}>
          {excerpt}
        </p>
      </blockquote>

      {/* Attribution */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#6b5fa5" }}>
          {"\u2014"} {author}
        </div>
        {source && (
          <div style={{
            fontSize: 11, color: "#8a7fa0", fontStyle: "italic",
            marginTop: 3,
          }}>
            {source}
          </div>
        )}
      </div>
    </div>
  );
}
