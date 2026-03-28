export default function FollowupChat() {
  const bubbles = [
    {
      role: "user" as const,
      text: "Why does this feel more like a search for safety?",
    },
    {
      role: "assistant" as const,
      text: "The house suggests safety, but the water keeps it moving.",
    },
  ];

  const pills = ["Why water?", "Compare Mar 14", "Jung only"];

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
        boxShadow:
          "0 4px 24px rgba(91,110,175,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
        padding: "20px 20px 16px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <div style={{ fontSize: 11, color: "#7a7a8e", fontWeight: 400 }}>
            Talking about
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#5B6EAF",
              background: "rgba(91,110,175,0.10)",
              padding: "3px 8px",
              borderRadius: 99,
            }}
          >
            Follow-up chat
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#5a5a6e",
            fontWeight: 400,
            marginBottom: 8,
          }}
        >
          Water under the old house
        </div>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 17,
            fontWeight: 700,
            color: "#1a1a2e",
          }}
        >
          Stay with this dream.
        </div>
      </div>

      {/* Chat bubbles */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflowY: "auto",
          marginBottom: 12,
        }}
      >
        {bubbles.map((b, i) => (
          <div
            key={i}
            style={{
              alignSelf: b.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background:
                b.role === "user"
                  ? "rgba(91,110,175,0.12)"
                  : "rgba(238,234,255,0.4)",
              borderRadius: 14,
              padding: "10px 14px",
              fontSize: 12.5,
              lineHeight: 1.55,
              color: b.role === "user" ? "#3a3a5e" : "#4a4a5e",
              fontWeight: b.role === "user" ? 400 : 300,
            }}
          >
            {b.text}
          </div>
        ))}
      </div>

      {/* Prompt pills */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {pills.map((p) => (
          <div
            key={p}
            style={{
              fontSize: 11,
              color: "#5B6EAF",
              background: "rgba(238,234,255,0.45)",
              border: "1px solid rgba(91,110,175,0.15)",
              borderRadius: 99,
              padding: "5px 12px",
              cursor: "pointer",
              fontWeight: 400,
            }}
          >
            {p}
          </div>
        ))}
      </div>

      {/* Chat input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.6)",
          borderRadius: 12,
          border: "1px solid rgba(91,110,175,0.12)",
          padding: "8px 12px",
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: 12,
            color: "#aaa",
          }}
        >
          Ask about this dream...
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "linear-gradient(135deg, #5B6EAF, #7B68C8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
      </div>
    </div>
  );
}
