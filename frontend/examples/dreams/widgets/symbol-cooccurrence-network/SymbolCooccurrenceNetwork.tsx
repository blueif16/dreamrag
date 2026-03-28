"use client";

import { useEffect, useRef } from "react";

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
`;

const CENTER = { x: 400, y: 248, r: 42, label: "Water", weight: 1 };

const NODES = [
  { id: "ocean",      label: "Ocean",      x: 578, y: 248, weight: 0.90 },
  { id: "rain",       label: "Rain",       x: 523, y: 371, weight: 0.85 },
  { id: "swimming",   label: "Swimming",   x: 400, y: 421, weight: 0.78 },
  { id: "river",      label: "River",      x: 277, y: 371, weight: 0.72 },
  { id: "drowning",   label: "Drowning",   x: 222, y: 248, weight: 0.55 },
  { id: "flood",      label: "Flood",      x: 277, y: 125, weight: 0.48 },
  { id: "shore",      label: "Shore",      x: 400, y: 75,  weight: 0.58 },
  { id: "reflection", label: "Reflection", x: 523, y: 125, weight: 0.65 },
];

function nodeRadius(w: number) { return 14 + w * 16; }
function edgeWidth(w: number) { return 1 + w * 5; }
function edgeOpacity(w: number) { return 0.25 + w * 0.45; }

export default function SymbolCooccurrenceNetwork() {
  const pulseRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = pulseRef.current;
    if (!el) return;
    let frame = 0;
    let raf: number;
    const animate = () => {
      frame++;
      const scale = 1 + 0.06 * Math.sin(frame * 0.04);
      const opacity = 0.18 + 0.10 * Math.sin(frame * 0.04);
      el.setAttribute("r", String(CENTER.r * scale));
      el.setAttribute("opacity", String(opacity));
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

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
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        overflow: "hidden",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        minHeight: 380,
      }}
    >
      <style>{FONTS}</style>
      <style>{`
        @keyframes fadeInNode { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
        .cooc-node { animation: fadeInNode 0.5s ease both; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5B6EAF", marginBottom: 3 }}>
            Symbol Co-occurrence Network
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 600, color: "#1a1a2e" }}>
            What appears alongside Water
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#aaa", textAlign: "right", lineHeight: 1.5 }}>
          Line weight = co-occurrence strength
          <br />Built from doc_relations edges
        </div>
      </div>

      {/* SVG Network */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg
          viewBox="0 0 800 496"
          width="100%"
          height="100%"
          style={{ overflow: "visible" }}
        >
          <defs>
            <radialGradient id="centerGrad" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#7B68C8" />
              <stop offset="100%" stopColor="#5B6EAF" />
            </radialGradient>
            <radialGradient id="nodeGrad" cx="40%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#EEEAFF" />
              <stop offset="100%" stopColor="#D4CCFF" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="softglow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {NODES.map((n) => (
            <line
              key={n.id}
              x1={CENTER.x} y1={CENTER.y}
              x2={n.x} y2={n.y}
              stroke="url(#centerGrad)"
              strokeWidth={edgeWidth(n.weight)}
              opacity={edgeOpacity(n.weight)}
              strokeLinecap="round"
            />
          ))}

          {/* Pulse ring around center */}
          <circle
            ref={pulseRef}
            cx={CENTER.x} cy={CENTER.y}
            r={CENTER.r}
            fill="none"
            stroke="#5B6EAF"
            strokeWidth={2}
            opacity={0.18}
          />

          {/* Center node */}
          <circle
            cx={CENTER.x} cy={CENTER.y}
            r={CENTER.r}
            fill="url(#centerGrad)"
            filter="url(#glow)"
          />
          <text
            x={CENTER.x} y={CENTER.y + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="'Playfair Display', Georgia, serif"
            fontSize={14}
            fontWeight={700}
            fill="white"
          >
            Water
          </text>

          {/* Satellite nodes */}
          {NODES.map((n, i) => {
            const r = nodeRadius(n.weight);
            return (
              <g key={n.id} className="cooc-node" style={{ animationDelay: `${i * 60}ms` }}>
                <circle
                  cx={n.x} cy={n.y} r={r}
                  fill="url(#nodeGrad)"
                  stroke="rgba(91,110,175,0.30)"
                  strokeWidth={1.5}
                  filter="url(#softglow)"
                />
                <text
                  x={n.x} y={n.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="'DM Sans', system-ui, sans-serif"
                  fontSize={11}
                  fontWeight={500}
                  fill="#3a3a6a"
                >
                  {n.label}
                </text>
                <text
                  x={n.x} y={n.y + 13}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="'DM Sans', system-ui, sans-serif"
                  fontSize={9}
                  fill="#5B6EAF"
                  opacity={0.75}
                >
                  {Math.round(n.weight * 100)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
