"use client";

export default function DreamAtmosphere() {
  const center = { x: 200, y: 180, label: "Water" };
  const satellites = [
    { label: "Falling", x: 90, y: 70, opacity: 0.6 },
    { label: "Mother", x: 320, y: 80, opacity: 0.45 },
    { label: "House", x: 340, y: 260, opacity: 0.7 },
    { label: "Running", x: 80, y: 280, opacity: 0.35 },
    { label: "Night", x: 200, y: 330, opacity: 0.55 },
  ];

  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    cx: 40 + Math.random() * 320,
    cy: 40 + Math.random() * 300,
    r: 1.5 + Math.random() * 2.5,
    delay: Math.random() * 6,
    duration: 4 + Math.random() * 4,
  }));

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
        padding: "24px 26px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes atmosphereFloat {
          0%, 100% { transform: translateY(0px); opacity: 0.25; }
          50% { transform: translateY(-12px); opacity: 0.6; }
        }
        @keyframes atmospherePulse {
          0%, 100% { r: 42; opacity: 0.15; }
          50% { r: 48; opacity: 0.25; }
        }
      `}</style>

      {/* Eyebrow */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#5B6EAF",
          marginBottom: 10,
        }}
      >
        Dream Atmosphere
      </div>

      {/* SVG Network */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox="0 0 400 380" width="100%" height="100%">
          <defs>
            <radialGradient id="atm-center-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7B68C8" />
              <stop offset="100%" stopColor="#5B6EAF" />
            </radialGradient>
          </defs>

          {/* Connecting lines */}
          {satellites.map((s) => (
            <line
              key={s.label}
              x1={center.x}
              y1={center.y}
              x2={s.x}
              y2={s.y}
              stroke="#5B6EAF"
              strokeWidth={1.2}
              opacity={s.opacity * 0.5}
              strokeDasharray="4 3"
            />
          ))}

          {/* Floating particles */}
          {particles.map((p) => (
            <circle
              key={p.id}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill="#C4899C"
              opacity={0.3}
              style={{
                animation: `atmosphereFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
              }}
            />
          ))}

          {/* Center glow */}
          <circle
            cx={center.x}
            cy={center.y}
            r={44}
            fill="rgba(91,110,175,0.08)"
            style={{
              animation: "atmospherePulse 4s ease-in-out infinite",
            }}
          />

          {/* Center node */}
          <circle
            cx={center.x}
            cy={center.y}
            r={32}
            fill="url(#atm-center-grad)"
            opacity={0.9}
          />
          <text
            x={center.x}
            y={center.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="'Playfair Display', Georgia, serif"
            fontSize={14}
            fontWeight={700}
            fill="#fff"
          >
            {center.label}
          </text>

          {/* Satellite nodes */}
          {satellites.map((s) => (
            <g key={s.label}>
              <circle
                cx={s.x}
                cy={s.y}
                r={22}
                fill="rgba(238,234,255,0.6)"
                stroke="rgba(91,110,175,0.2)"
                strokeWidth={1}
              />
              <text
                x={s.x}
                y={s.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={500}
                fill="#5B6EAF"
                fontFamily="'DM Sans', system-ui, sans-serif"
              >
                {s.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Bottom note */}
      <div
        style={{
          fontSize: 12,
          color: "#7a7a8e",
          fontWeight: 300,
          fontStyle: "italic",
          lineHeight: 1.45,
          marginTop: 6,
        }}
      >
        The dream gathers its symbols softly, all at once.
      </div>
    </div>
  );
}
