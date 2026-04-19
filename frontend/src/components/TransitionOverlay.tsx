"use client";

/**
 * Minimal transition helper — just flags that a page transition is in progress.
 * Body bg in globals.css matches the dashboard so there's no white flash.
 * The dashboard page reads this flag to play its slide-up entrance.
 */
export function triggerPageTransition() {
  sessionStorage.setItem("dreamrag_transition", "1");
}

export function consumePageTransition(): boolean {
  if (typeof window === "undefined") return false;
  const had = sessionStorage.getItem("dreamrag_transition") === "1";
  if (had) sessionStorage.removeItem("dreamrag_transition");
  return had;
}
