"use client";

interface Props {
  center_symbol: string;
  satellites: string[];
}

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  cx: 40 + (i * 31) % 320,
  cy: 40 + (i * 47) % 300,
  r: 1.5 + (i % 3) * 0.8,
  delay: (i * 0.5) % 6,
  duration: 4 + (i % 4),
}));

function parseSatellites(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "[]") return [];
    // Python repr: "['a','b']"
    if (trimmed.startsWith("[")) {
      try { return JSON.parse(trimmed.replace(/'/g, '"')); } catch {}
    }
    // Comma-separated: "a, b, c"
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default function DreamAtmosphere({ center_symbol, satellites: rawSatellites }: Props) {
  const satellites = parseSatellites(rawSatellites);
  if (!satellites.length) return null;
  const cx = 200;
  const cy = 180;
  const orbitR = 150;

  const satelliteNodes = satellites.map((label, i) => {
    const angle = (Math.PI * 2 * i) / satellites.length - Math.PI / 2;
    return {
      label,
      x: cx + orbitR * Math.cos(angle),
      y: cy + orbitR * Math.sin(angle),
    };
  });

  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "rgba(255,255,255,0.60)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderRadius: 20,
      border: "1px solid rgba(255,255,255,0.75)",
      boxShadow: "0 4px 24px rgba(91,110,175,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
      padding: "24px 26px",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes atmosphereFloat {
          0%, 100% { transform: translateY(0px); opacity: 0.25; }
          50% { transform: translateY(-12px); opacity: 0.6; }
        }
      `}</style>

      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5B6EAF", marginBottom: 10 }}>
        Dream Atmosphere
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox="0 0 400 380" width="100%" height="100%">
          <defs>
            <radialGradient id="atm-center-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7B68C8" />
              <stop offset="100%" stopColor="#5B6EAF" />
            </radialGradient>
          </defs>

          {satelliteNodes.map((s) => (
            <line key={s.label} x1={cx} y1={cy} x2={s.x} y2={s.y}
              stroke="#5B6EAF" strokeWidth={1.2} opacity={0.3} strokeDasharray="4 3" />
          ))}

          {PARTICLES.map((p) => (
            <circle key={p.id} cx={p.cx} cy={p.cy} r={p.r} fill="#C4899C" opacity={0.3}
              style={{ animation: `atmosphereFloat ${p.duration}s ease-in-out ${p.delay}s infinite` }} />
          ))}

          <circle cx={cx} cy={cy} r={44} fill="rgba(91,110,175,0.08)" />
          <circle cx={cx} cy={cy} r={32} fill="url(#atm-center-grad)" opacity={0.9} />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
            fontFamily="'Playfair Display', Georgia, serif" fontSize={14} fontWeight={700} fill="#fff">
            {center_symbol}
          </text>

          {satelliteNodes.map((s) => (
            <g key={s.label}>
              <circle cx={s.x} cy={s.y} r={22} fill="rgba(238,234,255,0.6)" stroke="rgba(91,110,175,0.2)" strokeWidth={1} />
              <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fontWeight={500} fill="#5B6EAF" fontFamily="'DM Sans', system-ui, sans-serif">
                {s.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div style={{ fontSize: 12, color: "#7a7a8e", fontWeight: 300, fontStyle: "italic", lineHeight: 1.45, marginTop: 6 }}>
        The dream gathers its symbols softly, all at once.
      </div>
    </div>
  );
}
