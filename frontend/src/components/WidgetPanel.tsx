"use client";

import { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { widgetEntries } from "@/lib/widgetEntries";
import type { SpawnedWidget } from "@/lib/types";
import type { WidgetLayout } from "@/types/state";

function layoutClasses(layout?: WidgetLayout): string {
  const w = layout?.width ?? "half";
  const h = layout?.height ?? "compact";
  const widthClass =
    w === "full"
      ? "col-span-3"
      : w === "half"
      ? "col-span-2"
      : "col-span-1";
  const heightClass =
    h === "fill"
      ? "min-h-[calc(100vh-8rem)]"
      : h === "tall"
      ? "min-h-[500px]"
      : h === "medium"
      ? "min-h-[300px]"
      : "";
  return `${widthClass} ${heightClass}`.trim();
}

/* ---------- source_chunk_ids normalizer ---------- */
function parseChunkIds(raw: unknown): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === "number" || typeof v === "string").map(Number).filter(Boolean);
  if (typeof raw === "string") {
    const trimmed = raw.replace(/^\[|\]$/g, "").trim();
    if (!trimmed) return [];
    return trimmed.split(",").map((s) => Number(s.trim())).filter(Boolean);
  }
  return [];
}

/* ---------- pre-render empty check ---------- */
function parseSatellites(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "[]") return [];
    if (t.startsWith("[")) { try { return JSON.parse(t.replace(/'/g, '"')); } catch {} }
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseSnippets(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") { try { return JSON.parse(raw.replace(/'/g, '"')); } catch { return []; } }
  return [];
}

function isWidgetEmpty(id: string, props: Record<string, unknown>): boolean {
  switch (id) {
    case "community_mirror": return !parseSnippets(props.snippets).length;
    case "echoes_card": {
      const e = props.echoes;
      if (!e) return true;
      if (Array.isArray(e)) return !e.length;
      if (typeof e === "string") { try { return !JSON.parse(e.replace(/'/g, '"')).length; } catch { return true; } }
      return true;
    }
    case "dream_atmosphere": return !parseSatellites(props.satellites).length;
    case "textbook_card": return !props.excerpt;
    case "followup_chat": return !props.prompts || !(props.prompts as unknown[]).length;
    case "current_dream": return !props.meaning && !props.title;
    default: return false;
  }
}

/* ---------- chunk detail types ---------- */
interface ChunkDetail {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  namespace: string;
  created_at: string;
}

/* ---------- chunk overlay (portal) ---------- */
function ChunkOverlay({ chunkId, onClose }: { chunkId: number; onClose: () => void }) {
  const [chunk, setChunk] = useState<ChunkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/chunks?ids=${chunkId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.chunks?.length) setChunk(d.chunks[0]);
        else setError("Chunk not found");
      })
      .catch(() => setError("Failed to fetch"))
      .finally(() => setLoading(false));
  }, [chunkId]);

  const meta = chunk?.metadata ?? {};
  const metaEntries = Object.entries(meta).filter(
    ([k]) => !["embedding", "content_hash"].includes(k),
  );

  return createPortal(
    <div style={overlayBackdrop} onClick={onClose}>
      <div style={overlayCard} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4899C", marginBottom: 4 }}>
              Source Chunk
            </div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 600, color: "#1a1a2e" }}>
              #{chunkId}
            </div>
          </div>
          <button onClick={onClose} style={overlayCloseBtn} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6EAF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#9B8FC4", fontSize: 13 }}>Loading...</div>
        ) : error ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#C4899C", fontSize: 13 }}>{error}</div>
        ) : chunk ? (
          <>
            {/* namespace + date badges */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={badgeStyle}>{chunk.namespace}</span>
              {chunk.created_at && (
                <span style={{ ...badgeStyle, color: "#7a7a8e", background: "rgba(122,122,142,0.08)", border: "1px solid rgba(122,122,142,0.12)" }}>
                  {new Date(chunk.created_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* content */}
            <div style={contentBox}>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5B6EAF", marginBottom: 8 }}>
                Content
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "#3a3a4a", whiteSpace: "pre-wrap" }}>
                {chunk.content}
              </p>
            </div>

            {/* metadata */}
            {metaEntries.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5B6EAF", marginBottom: 10 }}>
                  Metadata
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {metaEntries.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                      <span style={{ fontWeight: 500, color: "#5a5a6e", minWidth: 100, flexShrink: 0 }}>{k}</span>
                      <span style={{ color: "#7a7a8e", wordBreak: "break-word" }}>
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- citation back face ---------- */
function CitationBack({
  widgetName, chunkIds, onFlip, onChunkClick,
}: {
  widgetName: string; chunkIds: number[]; onFlip: () => void; onChunkClick: (id: number) => void;
}) {
  return (
    <div style={backFaceStyle}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4899C", marginBottom: 4 }}>
            Sources
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>
            {widgetName}
          </div>
        </div>
        <button onClick={onFlip} style={flipBtnStyle} type="button" title="Back to widget">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B6EAF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      {chunkIds.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 13, color: "rgba(64,56,82,0.45)", fontWeight: 400, fontStyle: "italic" }}>
            Self-contained — no external sources
          </p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#7a7a8e", marginBottom: 14, fontWeight: 400 }}>
            Based on {chunkIds.length} retrieved chunk{chunkIds.length > 1 ? "s" : ""} from the dream corpus
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {chunkIds.map((id) => (
              <button
                key={id}
                onClick={() => onChunkClick(id)}
                type="button"
                style={chunkPillStyle}
              >
                #{id}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: "rgba(64,56,82,0.35)", fontStyle: "italic" }}>
            Click a chunk to view its source text
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- flippable card wrapper ---------- */
function FlippableCard({ id, Component, props }: SpawnedWidget) {
  const entry = widgetEntries.find((e) => e.config.id === id);
  const [flipped, setFlipped] = useState(false);
  const [viewingChunk, setViewingChunk] = useState<number | null>(null);
  const toggle = useCallback(() => setFlipped((f) => !f), []);

  const { source_chunk_ids, ...widgetProps } = props;
  const chunkIds = parseChunkIds(source_chunk_ids);
  const widgetName = entry?.config.tool?.name?.replace(/^show_/, "").replace(/_/g, " ") ?? id.replace(/_/g, " ");
  const displayName = widgetName.charAt(0).toUpperCase() + widgetName.slice(1);

  return (
    <div className={layoutClasses(entry?.config.layout)} style={{ perspective: 1200 }}>
      <div style={{
        position: "relative",
        width: "100%", height: "100%",
        transformStyle: "preserve-3d",
        transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: flipped ? "rotateY(180deg)" : "none",
      }}>
        {/* front */}
        <div style={{ position: "relative", backfaceVisibility: "hidden", width: "100%", height: "100%" }}>
          <Suspense fallback={<div className="animate-pulse h-32 rounded-[20px]" style={{ background: "rgba(238,234,255,0.3)" }} />}>
            <Component {...widgetProps} widgetId={id} />
          </Suspense>
          {/* flip trigger */}
          <button onClick={toggle} style={sourceTagStyle} type="button" title="View sources">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <span>{chunkIds.length ? `${chunkIds.length} src` : "info"}</span>
          </button>
        </div>

        {/* back */}
        <CitationBack widgetName={displayName} chunkIds={chunkIds} onFlip={toggle} onChunkClick={setViewingChunk} />
      </div>

      {/* chunk detail overlay */}
      {viewingChunk !== null && (
        <ChunkOverlay chunkId={viewingChunk} onClose={() => setViewingChunk(null)} />
      )}
    </div>
  );
}

/* ---------- main panel ---------- */
interface Props {
  spawned: SpawnedWidget[];
}

export function WidgetPanel({ spawned }: Props) {
  const visible = useMemo(
    () => spawned.filter((sw) => !isWidgetEmpty(sw.id, sw.props)),
    [spawned],
  );

  return (
    <div className="grid grid-cols-3 gap-3 h-full auto-rows-min">
      {visible.map((sw) => (
        <FlippableCard key={sw.id} {...sw} />
      ))}
    </div>
  );
}

/* ---------- styles ---------- */
const sourceTagStyle: React.CSSProperties = {
  position: "absolute", bottom: 10, right: 10,
  display: "flex", alignItems: "center", gap: 4,
  fontSize: 10, fontWeight: 500, color: "#5B6EAF",
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(91,110,175,0.15)",
  borderRadius: 99, padding: "3px 9px",
  cursor: "pointer", zIndex: 2,
};

const flipBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 10,
  background: "rgba(238,234,255,0.4)",
  border: "1px solid rgba(91,110,175,0.12)",
  cursor: "pointer",
};

const backFaceStyle: React.CSSProperties = {
  position: "absolute", inset: 0,
  backfaceVisibility: "hidden",
  transform: "rotateY(180deg)",
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 4px 24px rgba(91,110,175,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
  padding: "24px 26px",
  display: "flex", flexDirection: "column",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  overflow: "hidden",
};

const chunkPillStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, fontFamily: "monospace",
  color: "#5B6EAF", background: "rgba(91,110,175,0.08)",
  border: "1px solid rgba(91,110,175,0.15)",
  borderRadius: 8, padding: "4px 10px",
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const overlayBackdrop: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  background: "rgba(26, 26, 46, 0.35)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 24,
};

const overlayCard: React.CSSProperties = {
  width: "100%", maxWidth: 620, maxHeight: "80vh",
  overflowY: "auto",
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.82)",
  boxShadow: "0 24px 64px rgba(91,110,175,0.18), 0 1px 0 rgba(255,255,255,0.8) inset",
  padding: "28px 32px",
  fontFamily: "'DM Sans', system-ui, sans-serif",
};

const overlayCloseBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 34, height: 34, borderRadius: 12,
  background: "rgba(238,234,255,0.4)",
  border: "1px solid rgba(91,110,175,0.12)",
  cursor: "pointer", flexShrink: 0,
};

const badgeStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500,
  color: "#5B6EAF", background: "rgba(91,110,175,0.08)",
  border: "1px solid rgba(91,110,175,0.12)",
  borderRadius: 99, padding: "3px 10px",
};

const contentBox: React.CSSProperties = {
  background: "rgba(238,234,255,0.25)",
  borderRadius: 14, padding: "16px 18px",
  borderLeft: "3px solid rgba(91,110,175,0.25)",
};
