"use client";
import { useEffect, useState } from "react";

interface Emotion {
  label: string;
  pct: number;
}

const EMOTION_COLORS: Record<string, string> = {
  anxiety: "#c4899c",
  joy: "#c9a55a",
  sadness: "#6b5fa5",
  anger: "#d47a6b",
  fear: "#8b7fb8",
  confusion: "#9b8fb8",
  peace: "#7d9a6e",
  excitement: "#d4a853",
  love: "#c4899c",
  wonder: "#5b9dad",
};

const FALLBACK_COLOR = "#6b5fa5";

export default function EmotionalClimate() {
  const [emotions, setEmotions] = useState<Emotion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [totalDreams, setTotalDreams] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/user-profile?user_id=default")
      .then((r) => r.json())
      .then((d) => {
        const dist = d.emotion_distribution;
        if (Array.isArray(dist) && dist.length > 0) {
          setEmotions(dist);
        }
        if (typeof d.total_dreams === "number") {
          setTotalDreams(d.total_dreams);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && emotions) {
      const t = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(t);
    }
  }, [loading, emotions]);

  if (!loading && !emotions) return null;

  const container: React.CSSProperties = {
    width: "100%",
    height: "100%",
    background: "rgba(255,255,255,0.55)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.65)",
    boxShadow:
      "0 2px 20px rgba(80,68,100,0.05), inset 0 1px 0 rgba(255,255,255,0.7)",
    padding: "24px 26px",
    display: "flex",
    flexDirection: "column" as const,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    overflow: "hidden",
  };

  const questionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#9b8fb8",
    marginBottom: 10,
  };

  const maxPct = emotions ? Math.max(...emotions.map((e) => e.pct), 1) : 1;

  return (
    <div style={container}>
      <div style={questionLabel}>How do you feel when you dream?</div>

      {loading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            flex: 1,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div
                style={{
                  width: 60 + i * 15,
                  height: 10,
                  borderRadius: 5,
                  background: "rgba(107,95,165,0.06)",
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  width: "100%",
                  height: 6,
                  borderRadius: 3,
                  background: "rgba(107,95,165,0.04)",
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              flex: 1,
            }}
          >
            {emotions!.map((e, i) => {
              const color =
                EMOTION_COLORS[e.label.toLowerCase()] || FALLBACK_COLOR;
              const barWidth = (e.pct / maxPct) * 100;

              return (
                <div
                  key={e.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "#524a65",
                      fontWeight: 500,
                      minWidth: 72,
                      textTransform: "capitalize",
                    }}
                  >
                    {e.label}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(107,95,165,0.06)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: mounted ? `${barWidth}%` : "0%",
                        borderRadius: 3,
                        background: color,
                        opacity: 0.75,
                        transition: `width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${i * 0.06}s`,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#8a7fa0",
                      fontWeight: 500,
                      minWidth: 32,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {e.pct}%
                  </span>
                </div>
              );
            })}
          </div>

          {totalDreams != null && (
            <div
              style={{
                fontSize: 11,
                color: "#8a7fa0",
                marginTop: 16,
              }}
            >
              Based on {totalDreams} recorded dream{totalDreams !== 1 ? "s" : ""}
            </div>
          )}
        </>
      )}
    </div>
  );
}
