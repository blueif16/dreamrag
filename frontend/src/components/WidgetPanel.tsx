"use client";

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { widgetEntries } from "@/lib/widgetEntries";
import { isWidgetEmpty } from "@/lib/widgetEmpty";
import type { SpawnedWidget } from "@/lib/types";
import type { WidgetLayout } from "@/types/state";

function layoutClasses(layout?: WidgetLayout): string {
  const w = layout?.width ?? "half";
  const h = layout?.height ?? "compact";
  const widthClass =
    w === "full"
      ? "col-span-6"
      : w === "half"
      ? "col-span-3"
      : "col-span-2";
  const heightClass =
    h === "fill"
      ? "min-h-[calc(100vh-8rem)]"
      : h === "tall"
      ? "min-h-[420px]"
      : h === "medium"
      ? "min-h-[280px]"
      : "min-h-[160px]";
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


/* ---------- focusable card wrapper ---------- */
function FocusableCard({ id, Component, props, isFocused, onFocus, onDismiss }: SpawnedWidget & {
  isFocused: boolean;
  onFocus: () => void;
  onDismiss: () => void;
}) {
  const entry = widgetEntries.find((e) => e.config.id === id);
  const [showSources, setShowSources] = useState(false);
  const [showChipPopover, setShowChipPopover] = useState(false);
  const [viewingChunk, setViewingChunk] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);

  const { source_chunk_ids, ...widgetProps } = props;
  const chunkIds = parseChunkIds(source_chunk_ids);
  const widgetName = entry?.config.tool?.name?.replace(/^show_/, "").replace(/_/g, " ") ?? id.replace(/_/g, " ");
  const displayName = widgetName.charAt(0).toUpperCase() + widgetName.slice(1);

  // Capture card position when focused so the portal overlay can mirror it
  // Also decide whether the action panel goes left or right
  const [panelSide, setPanelSide] = useState<"right" | "left">("right");
  useEffect(() => {
    if (isFocused && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setCardRect(rect);
      // If less than 200px of space to the right, render on the left
      setPanelSide(window.innerWidth - rect.right < 200 ? "left" : "right");
    } else {
      setCardRect(null);
      setShowSources(false);
    }
  }, [isFocused]);

  const handleCardClick = useCallback(() => {
    if (!isFocused) onFocus();
  }, [isFocused, onFocus]);

  const handleDismiss = useCallback(() => {
    setShowSources(false);
    onDismiss();
  }, [onDismiss]);

  return (
    <>
      {/* grid placeholder — always in flow */}
      <div
        ref={cardRef}
        className={layoutClasses(entry?.config.layout)}
        style={{ cursor: isFocused ? "default" : "pointer", position: "relative" }}
        onClick={handleCardClick}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 20, opacity: isFocused ? 0 : 1, transition: "opacity 0.2s ease" }}>
          <Suspense fallback={<div className="animate-pulse h-32 rounded-[20px]" style={{ background: "rgba(238,234,255,0.3)" }} />}>
            <Component {...widgetProps} widgetId={id} />
          </Suspense>
        </div>

        {/* always-visible source chip — does not require focus */}
        {!isFocused && chunkIds.length > 0 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowChipPopover((v) => !v);
              }}
              style={sourceChipStyle}
              title="View source chunks"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <span>{chunkIds.length} src</span>
            </button>
            {showChipPopover && (
              <div
                style={chipPopoverStyle}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4899C" }}>
                    Sources
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowChipPopover(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#5B6EAF" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {chunkIds.map((cid) => (
                    <button
                      key={cid}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowChipPopover(false);
                        setViewingChunk(cid);
                      }}
                      style={chunkPillStyle}
                    >
                      #{cid}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* when focused: portal the card + action panel above the backdrop */}
      {isFocused && cardRect && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 95, pointerEvents: "none" }}>
          {/* card clone positioned exactly where the grid card is */}
          <div style={{
            position: "absolute",
            top: cardRect.top,
            left: cardRect.left,
            width: cardRect.width,
            height: cardRect.height,
            pointerEvents: "auto",
            borderRadius: 20,
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: "scale(1.01)",
          }}>
            <Suspense fallback={null}>
              <Component {...widgetProps} widgetId={id} />
            </Suspense>
          </div>

          {/* action panel — left or right side of card */}
          <div
            style={{
              position: "absolute",
              top: cardRect.top + 16,
              ...(panelSide === "right"
                ? { left: cardRect.left + cardRect.width + 12 }
                : { left: cardRect.left - 12, transform: "translateX(-100%)" }),
              pointerEvents: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              animation: panelSide === "right"
                ? "action-panel-in-right 0.25s cubic-bezier(0.4, 0, 0.2, 1) both"
                : "action-panel-in-left 0.25s cubic-bezier(0.4, 0, 0.2, 1) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSources((s) => !s)}
              style={{
                ...actionBtnStyle,
                background: showSources ? "rgba(91,110,175,0.12)" : actionBtnStyle.background,
              }}
              type="button"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <span>Sources{chunkIds.length ? ` (${chunkIds.length})` : ""}</span>
            </button>
            <button onClick={handleDismiss} style={actionBtnStyle} type="button">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
              <span>Close</span>
            </button>

            {/* sources panel inline below buttons */}
            {showSources && (
              <div style={{ marginTop: 4, animation: "action-panel-in 0.2s ease both" }}>
                <SourcesDropdown
                  widgetName={displayName}
                  chunkIds={chunkIds}
                  onChunkClick={setViewingChunk}
                  onClose={() => setShowSources(false)}
                />
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* chunk detail overlay */}
      {viewingChunk !== null && (
        <ChunkOverlay chunkId={viewingChunk} onClose={() => setViewingChunk(null)} />
      )}
    </>
  );
}

/* ---------- sources dropdown panel ---------- */
function SourcesDropdown({ widgetName, chunkIds, onChunkClick, onClose }: {
  widgetName: string; chunkIds: number[]; onChunkClick: (id: number) => void; onClose: () => void;
}) {
  return (
    <div style={sourcesDropdownStyle} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4899C", marginBottom: 2 }}>
            Sources
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>
            {widgetName}
          </div>
        </div>
        <button onClick={onClose} style={flipBtnStyle} type="button" title="Close sources">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5B6EAF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
      {chunkIds.length === 0 ? (
        <p style={{ fontSize: 12, color: "rgba(64,56,82,0.45)", fontStyle: "italic", margin: 0 }}>
          Self-contained — no external sources
        </p>
      ) : (
        <>
          <div style={{ fontSize: 11, color: "#7a7a8e", marginBottom: 10 }}>
            {chunkIds.length} chunk{chunkIds.length > 1 ? "s" : ""} from dream corpus
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {chunkIds.map((cid) => (
              <button key={cid} onClick={() => onChunkClick(cid)} type="button" style={chunkPillStyle}>
                #{cid}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- parse followup prompts (shared with dashboard) ---------- */
function coerceToString(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    for (const k of ["prompt", "text", "question", "label", "value"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  return "";
}

function parseFollowupPrompts(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(coerceToString).filter(Boolean);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "[]") return [];
    try { const p = JSON.parse(t); if (Array.isArray(p)) return p.map(coerceToString).filter(Boolean); } catch {}
    try { const p = JSON.parse(t.replace(/'/g, '"')); if (Array.isArray(p)) return p.map(coerceToString).filter(Boolean); } catch {}
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/* ---------- main panel ---------- */
interface Props {
  spawned: SpawnedWidget[];
}

export function WidgetPanel({ spawned }: Props) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Separate followup_chat from grid widgets — it renders as tags above the input
  const { gridWidgets, followupPrompts } = useMemo(() => {
    const all = spawned.filter((sw) => !isWidgetEmpty(sw.id, sw.props));
    const followup = all.find((sw) => sw.id === "followup_chat");
    return {
      gridWidgets: all.filter((sw) => sw.id !== "followup_chat"),
      followupPrompts: followup ? parseFollowupPrompts(followup.props.prompts) : [],
    };
  }, [spawned]);

  const dismissFocus = useCallback(() => setFocusedId(null), []);

  return (
    <>
      {/* keyframes for action panel */}
      <style>{`
        @keyframes action-panel-in-right {
          from { opacity: 0; transform: translateX(-8px) scale(0.96); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes action-panel-in-left {
          from { opacity: 0; transform: translateX(calc(-100% + 8px)) scale(0.96); }
          to { opacity: 1; transform: translateX(-100%) scale(1); }
        }
      `}</style>
      {/* backdrop — dims everything except focused card */}
      {focusedId && createPortal(
        <div style={focusBackdropStyle} onClick={dismissFocus} />,
        document.body,
      )}
      <div className="grid grid-cols-6 gap-5 h-full auto-rows-min" style={{ gridAutoFlow: "dense" }}>
        {gridWidgets.map((sw) => (
          <FocusableCard
            key={sw.id}
            {...sw}
            isFocused={focusedId === sw.id}
            onFocus={() => setFocusedId(sw.id)}
            onDismiss={dismissFocus}
          />
        ))}
      </div>
    </>
  );
}

/** Expose followup prompts for the dashboard to render above the input */
export function useFollowupPrompts(spawned: SpawnedWidget[]): string[] {
  return useMemo(() => {
    const f = spawned.find((sw) => sw.id === "followup_chat");
    return f ? parseFollowupPrompts(f.props.prompts) : [];
  }, [spawned]);
}

/* ---------- styles ---------- */
const focusBackdropStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 90,
  background: "rgba(26, 26, 46, 0.25)",
  backdropFilter: "blur(3px)",
  WebkitBackdropFilter: "blur(3px)",
  transition: "opacity 0.3s ease",
};

const actionBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  fontSize: 13, fontWeight: 500, color: "#5B6EAF",
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(91,110,175,0.18)",
  borderRadius: 14, padding: "10px 16px",
  cursor: "pointer",
  boxShadow: "0 6px 20px rgba(91,110,175,0.12)",
  whiteSpace: "nowrap",
  transition: "all 0.15s ease",
  minWidth: 130,
};

const sourcesDropdownStyle: React.CSSProperties = {
  width: 220,
  background: "rgba(255,255,255,0.9)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.8)",
  boxShadow: "0 12px 40px rgba(91,110,175,0.14), 0 1px 0 rgba(255,255,255,0.8) inset",
  padding: "16px 18px",
  fontFamily: "'DM Sans', system-ui, sans-serif",
};

const flipBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: 8,
  background: "rgba(238,234,255,0.4)",
  border: "1px solid rgba(91,110,175,0.12)",
  cursor: "pointer",
};

const chunkPillStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, fontFamily: "monospace",
  color: "#5B6EAF", background: "rgba(91,110,175,0.08)",
  border: "1px solid rgba(91,110,175,0.15)",
  borderRadius: 8, padding: "4px 10px",
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const sourceChipStyle: React.CSSProperties = {
  position: "absolute", bottom: 10, right: 10,
  display: "flex", alignItems: "center", gap: 4,
  fontSize: 10, fontWeight: 500, color: "#5B6EAF",
  background: "rgba(255,255,255,0.75)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(91,110,175,0.18)",
  borderRadius: 999, padding: "4px 10px",
  cursor: "pointer", zIndex: 5,
  boxShadow: "0 2px 6px rgba(91,110,175,0.08)",
  transition: "all 0.15s ease",
};

const chipPopoverStyle: React.CSSProperties = {
  position: "absolute", bottom: 40, right: 10,
  minWidth: 180, maxWidth: 260,
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.9)",
  borderRadius: 14, padding: 12,
  boxShadow: "0 12px 32px rgba(91,110,175,0.18), 0 1px 0 rgba(255,255,255,0.8) inset",
  zIndex: 10,
  fontFamily: "'DM Sans', system-ui, sans-serif",
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
