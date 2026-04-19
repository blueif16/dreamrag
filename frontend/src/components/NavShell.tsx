"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const NAV_ITEMS = [
  { id: "landing", label: "Dream", href: "/" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "archive", label: "Archive", href: "/archive" },
  { id: "profile", label: "Profile", href: "/profile" },
];

export function NavShell() {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      {/* Brand pill — top left */}
      <div style={brandWrapStyle}>
        <div style={brandPillStyle}>
          {/* Drop your logo PNG into frontend/public/logo/ */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/logo.png"
            alt="DreamRAG"
            style={brandLogoStyle}
          />
          <strong style={brandTextStyle}>DreamRAG</strong>
        </div>
      </div>

      {/* Left vertical dot nav */}
      <nav style={leftNavStyle}>
        <div style={navLineStyle} />
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const hovered = hoveredNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              onMouseEnter={() => setHoveredNav(item.id)}
              onMouseLeave={() => setHoveredNav(null)}
              style={{
                ...navItemStyle,
                opacity: active ? 1 : hovered ? 0.95 : 0.8,
              }}
              type="button"
            >
              <span
                style={{
                  ...navDotStyle,
                  background: active
                    ? "linear-gradient(180deg, #b6d5ff, #6b75d4)"
                    : "rgba(42, 35, 64, 0.55)",
                  transform: hovered && !active ? "scale(1.3)" : "scale(1)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: active
                    ? "0 0 8px rgba(107, 117, 212, 0.4)"
                    : "0 0 0 1px rgba(255, 255, 255, 0.4)",
                }}
              />
              <span
                style={{
                  ...navLabelStyle,
                  opacity: active ? 1 : hovered ? 0.95 : 0.78,
                  color: active ? "#6b75d4" : "#1f1935",
                  transform: "translateX(0)",
                  transition: "all 0.25s ease",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const brandWrapStyle: React.CSSProperties = {
  position: "fixed",
  top: 18,
  left: 18,
  zIndex: 20,
};

const brandPillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "6px 14px 6px 6px",
  borderRadius: 20,
  background: "rgba(30, 26, 42, 0.45)",
  backdropFilter: "blur(16px) saturate(140%)",
  border: "1px solid rgba(126, 135, 223, 0.12)",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
};

const brandLogoStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 10,
  objectFit: "contain",
};

const brandTextStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.03em",
  color: "rgba(220, 215, 230, 0.9)",
};

const leftNavStyle: React.CSSProperties = {
  position: "fixed",
  left: 18,
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
  gap: 22,
};

const navLineStyle: React.CSSProperties = {
  position: "absolute",
  left: 3,
  top: 10,
  bottom: 10,
  width: 1,
  background: "rgba(42, 35, 64, 0.3)",
  borderRadius: 1,
  pointerEvents: "none",
};

const navItemStyle: React.CSSProperties = {
  position: "relative" as const,
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px 0",
  transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  fontFamily: '"Manrope", sans-serif',
};

const navDotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0,
};

const navLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#1f1935",
  textShadow: "0 1px 8px rgba(255, 255, 255, 0.55)",
};
