"use client";
import { useEffect, useState } from "react";

interface RecurrenceItem {
  label: string;
  value: string;
  note: string;
}

function parseCount(value: string): number {
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
}

function parsePercent(note: string): string | null {
  const match = note.match(/(\d+)%/);
  return match ? match[1] + "%" : null;
}

export default function RecurrenceCard() {
  const [items, setItems] = useState<RecurrenceItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user-profile?user_id=demo_dreamer")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.recurrence) && d.recurrence.length > 0) {
          setItems(d.recurrence.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && !items) return null;

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

  const maxCount = items
    ? Math.max(...items.map((it) => parseCount(it.value)), 1)
    : 1;

  return (
    <div style={container}>
      <div style={questionLabel}>What keeps coming back?</div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 36,
                borderRadius: 10,
                background: "rgba(107,95,165,0.04)",
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items!.map((item, i) => {
            const count = parseCount(item.value);
            const pct = parsePercent(item.note);
            const dotCount = Math.min(
              Math.max(Math.round((count / maxCount) * 5), 1),
              5
            );

            return (
              <div
                key={`${i}:${item?.label ?? ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background:
                    i === 0 ? "rgba(107,95,165,0.06)" : "transparent",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#2d2640",
                    flex: 1,
                    textTransform: "capitalize",
                  }}
                >
                  {item.label}
                </span>

                <div
                  style={{
                    display: "flex",
                    gap: 3,
                    alignItems: "center",
                    marginRight: 12,
                  }}
                >
                  {Array.from({ length: 5 }).map((_, di) => (
                    <div
                      key={di}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background:
                          di < dotCount
                            ? "#6b5fa5"
                            : "rgba(107,95,165,0.12)",
                      }}
                    />
                  ))}
                </div>

                <span
                  style={{
                    fontSize: 12,
                    color: "#8a7fa0",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {count}&times;{pct ? ` \u00B7 ${pct} of dreams` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
