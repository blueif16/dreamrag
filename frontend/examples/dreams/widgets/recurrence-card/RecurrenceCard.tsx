"use client";
import { useEffect, useState } from "react";

interface Metric { label: string; value: string; note: string }

const FALLBACK: Metric[] = [
  { label: "no data yet", value: "—", note: "Record some dreams to see recurrence patterns." },
];

export default function RecurrenceCard() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user-profile?user_id=default")
      .then((r) => r.json())
      .then((d) => setMetrics(d.recurrence?.length ? d.recurrence : FALLBACK))
      .catch(() => setMetrics(FALLBACK))
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
      fontFamily: "'DM Sans', system-ui, sans-serif", overflow: "hidden",
    }}>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5B6EAF" }}>
        Recurrence
      </div>

      {loading ? (
        <div style={{ color: "#9B8FC4", fontSize: 13 }}>Loading…</div>
      ) : (
        metrics.map((m) => (
          <div key={m.label} style={{
            background: "rgba(238,234,255,0.3)", borderRadius: 14, padding: "16px 18px",
            border: "1px solid rgba(255,255,255,0.6)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#5B6EAF", textTransform: "lowercase", marginBottom: 4 }}>
              {m.label}
            </div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.1, marginBottom: 6 }}>
              {m.value}
            </div>
            <div style={{ fontSize: 12, color: "#7a7a8e", lineHeight: 1.45, fontWeight: 300 }}>
              {m.note}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
