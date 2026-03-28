"use client";
import { useEffect, useState } from "react";

interface Emotion { label: string; pct: number }

const PALETTE = ["#5B6EAF", "#D4A853", "#7BB89A", "#C4899C", "#7B68C8", "#8BBCCC"];

const FALLBACK: Emotion[] = [
  { label: "No dream data yet", pct: 100 },
];

export default function EmotionalClimate() {
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user-profile?user_id=default")
      .then((r) => r.json())
      .then((d) => setEmotions(d.emotion_distribution?.length ? d.emotion_distribution : FALLBACK))
      .catch(() => setEmotions(FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{
      width: "100%", height: "100%",
      background: "rgba(255,255,255,0.60)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      borderRadius: 20, border: "1px solid rgba(255,255,255,0.75)",
      boxShadow: "0 4px 24px rgba(91,110,175,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
      padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5B6EAF" }}>
        Emotional Climate
      </div>

      {loading ? (
        <div style={{ color: "#9B8FC4", fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {emotions.map((e, i) => (
            <div key={e.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 500 }}>{e.label}</span>
                <span style={{ fontSize: 12, color: "#7a7a8e" }}>{e.pct}%</span>
              </div>
              <div style={{ height: 8, background: "rgba(238,234,255,0.4)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  width: `${e.pct}%`, height: "100%",
                  background: PALETTE[i % PALETTE.length],
                  borderRadius: 99, opacity: 0.8,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
