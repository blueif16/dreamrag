export default function LucidityGauge() {
  const level = 0.25; // 25% fill
  const radius = 52;
  const stroke = 8;
  const cx = 65;
  const cy = 65;
  // Semi-circle arc (180 degrees)
  const circumference = Math.PI * radius;
  const filled = circumference * level;

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
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#5B6EAF",
          alignSelf: "flex-start",
          marginBottom: 8,
        }}
      >
        Lucidity
      </div>

      {/* Gauge */}
      <div style={{ position: "relative", width: 130, height: 75 }}>
        <svg
          width={130}
          height={75}
          viewBox={`0 0 ${cx * 2} ${cy + 5}`}
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="lucidGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#EEEAFF" />
              <stop offset="100%" stopColor="#5B6EAF" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Background arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="rgba(238,234,255,0.5)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="url(#lucidGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            filter="url(#glow)"
          />
        </svg>

        {/* Center text */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 22,
              fontWeight: 700,
              color: "#1a1a2e",
              lineHeight: 1,
            }}
          >
            Low
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 11,
          color: "#7a7a8e",
          marginTop: 6,
        }}
      >
        Dream-led state
      </div>
    </div>
  );
}
