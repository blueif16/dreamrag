interface Props {
  message: string;
  source_chunk_ids?: string[] | number[];
}

export default function TextResponse({ message }: Props) {
  if (!message || !message.trim()) return null;
  return (
    <div style={container}>
      <span style={eyebrow}>Response</span>
      <p style={body}>{message}</p>
      <style>{`
        @keyframes text-response-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const container: React.CSSProperties = {
  width: "100%",
  height: "100%",
  paddingLeft: 22,
  paddingTop: 8,
  paddingBottom: 8,
  borderLeft: "2px solid rgba(126,135,223,0.32)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  animation: "text-response-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) both",
};

const eyebrow: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#7e87df",
  fontFamily: "'Manrope', sans-serif",
};

const body: React.CSSProperties = {
  margin: 0,
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: "1.45rem",
  fontWeight: 500,
  lineHeight: 1.5,
  color: "#2d2640",
  letterSpacing: "-0.005em",
  whiteSpace: "pre-wrap",
  maxWidth: 820,
};
