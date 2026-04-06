"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ParticleBackground = dynamic(
  () => import("@/components/scene/ParticleBackground"),
  { ssr: false }
);

const SECTIONS = [
  { id: "dream", label: "Dream" },
  { id: "journey", label: "Journey" },
  { id: "awaken", label: "Awaken" },
];

const NAV_ITEMS = [
  { id: "landing", label: "Dream", href: "/" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
];

export default function LandingPage() {
  const [dream, setDream] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(() => {
    if (!dream.trim()) return;
    setSubmitted(true);
    sessionStorage.setItem("dreamrag_dream", dream.trim());
    setTimeout(() => router.push("/dashboard"), 600);
  }, [dream, router]);

  // Wire GSAP ScrollTrigger → particle morph progress
  useEffect(() => {
    // Dynamic import to avoid SSR issues with the module-level export
    let progressRef: { value: number } | null = null;
    let dissolveRef: { value: number } | null = null;
    import("@/components/scene/ParticleBackground").then((mod) => {
      progressRef = (mod as any).scrollProgress;
      dissolveRef = (mod as any).dissolveProgress;
    });

    const container = scrollContainerRef.current;
    if (!container) return;

    // ScrollTrigger: 3-phase remap (dissolve / morph1 / morph2)
    // Layout: 200vh sticky wrapper + 100vh + 100vh = 400vh total, 300vh scroll
    // Each third = 100vh of scrolling
    const DISSOLVE_END = 1 / 3;
    const trigger = ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: "bottom bottom",
      scrub: 1.5,
      onUpdate: (self) => {
        const raw = self.progress; // 0→1
        let morphProgress: number;
        let dissolve: number;

        if (raw < DISSOLVE_END) {
          // Phase 1: dissolve (mesh→particles), section 1 pinned via sticky
          dissolve = raw / DISSOLVE_END; // 0→1
          morphProgress = 0;
        } else {
          // Phase 2+3: particles morph
          dissolve = 1;
          morphProgress = ((raw - DISSOLVE_END) / (1 - DISSOLVE_END)) * 2; // 0→2
        }

        if (progressRef) progressRef.value = morphProgress;
        if (dissolveRef) dissolveRef.value = dissolve;

        // Update active section dot
        if (raw < 0.33) setActiveSection(0);
        else if (raw < 0.66) setActiveSection(1);
        else setActiveSection(2);
      },
    });

    return () => {
      trigger.kill();
    };
  }, []);

  const scrollToSection = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const vh = window.innerHeight;
    // Section 0 = 0, Section 1 = 200vh (after sticky wrapper), Section 2 = 300vh
    const offsets = [0, vh * 2, vh * 3];
    window.scrollTo({ top: offsets[index] ?? 0, behavior: "smooth" });
  };

  return (
    <div ref={scrollContainerRef} style={rootStyle}>
      {/* Gradient backdrop */}
      <div style={gradientStyle} />

      {/* 3D particles — fixed behind everything */}
      <ParticleBackground />

      {/* Left edge nav — page navigation */}
      <nav style={leftNavStyle}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              style={{
                ...navItemStyle,
                opacity: active ? 1 : 0.4,
              }}
              type="button"
            >
              <span
                style={{
                  ...navDotStyle,
                  background: active
                    ? "linear-gradient(180deg, #b6d5ff, #6b75d4)"
                    : "rgba(64, 56, 82, 0.3)",
                }}
              />
              <span style={navLabelStyle}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right edge dots — scroll section indicators */}
      <div style={rightDotsStyle}>
        {SECTIONS.map((section, i) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(i)}
            style={rightDotBtnStyle}
            type="button"
            title={section.label}
          >
            <span
              style={{
                ...rightDotStyle,
                background:
                  activeSection === i
                    ? "linear-gradient(180deg, #b6d5ff, #6b75d4)"
                    : "rgba(64, 56, 82, 0.2)",
                transform: activeSection === i ? "scale(1.4)" : "scale(1)",
              }}
            />
          </button>
        ))}
      </div>

      {/* Brand — top left */}
      <div style={brandStyle}>
        <div style={brandMarkStyle} />
        <strong style={brandTextStyle}>DreamRAG</strong>
      </div>

      {/* Section 1 — Dream input, pinned during dissolve */}
      <div style={dissolveWrapperStyle}>
        <section style={stickySection1Style}>
          <div
            style={{
              ...bottomContentStyle,
              opacity: submitted ? 0 : 1,
              transform: submitted ? "translateY(20px)" : "translateY(0)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
            }}
          >
            <p style={taglineStyle}>
              Describe the dream you woke up holding onto.
            </p>
            <div style={inputRowStyle}>
              <input
                autoFocus
                value={dream}
                onChange={(e) => setDream(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dream.trim()) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Last night I walked through deep water..."
                style={inputStyle}
              />
              <button
                onClick={handleSubmit}
                disabled={!dream.trim()}
                style={{
                  ...sendButtonStyle,
                  opacity: dream.trim() ? 1 : 0.4,
                  cursor: dream.trim() ? "pointer" : "default",
                }}
                type="button"
              >
                Analyze
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Section 2 — Journey */}
      <section style={sectionStyle}>
        <div style={sectionTextStyle}>
          <p style={sectionHeadingStyle}>The dream takes shape</p>
          <p style={sectionSubStyle}>
            Your subconscious narratives, surfaced and interpreted.
          </p>
        </div>
      </section>

      {/* Section 3 — Awaken */}
      <section style={sectionStyle}>
        <div style={sectionTextStyle}>
          <p style={sectionHeadingStyle}>Awaken with clarity</p>
          <p style={sectionSubStyle}>
            Patterns emerge. Meaning crystallizes.
          </p>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const rootStyle: React.CSSProperties = {
  position: "relative",
  width: "100vw",
  fontFamily: '"Manrope", sans-serif',
  color: "#403852",
};

const gradientStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 0,
  background: `
    radial-gradient(circle at 12% 18%, rgba(140, 180, 200, 0.4), transparent 24%),
    radial-gradient(circle at 84% 10%, rgba(160, 150, 210, 0.5), transparent 30%),
    radial-gradient(circle at 82% 82%, rgba(200, 150, 170, 0.4), transparent 24%),
    radial-gradient(circle at 28% 74%, rgba(130, 160, 210, 0.35), transparent 22%),
    linear-gradient(160deg, #d0c8c0 0%, #c8c0d4 46%, #d4cec4 100%)
  `,
};

const dissolveWrapperStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 10,
  height: "200vh",
};

const stickySection1Style: React.CSSProperties = {
  position: "sticky",
  top: 0,
  height: "100vh",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  paddingBottom: 48,
};

const sectionStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 10,
  height: "100vh",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  paddingBottom: 48,
};

const sectionTextStyle: React.CSSProperties = {
  textAlign: "center",
  maxWidth: 400,
};

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "1.8rem",
  fontWeight: 600,
  margin: "0 0 8px 0",
  color: "#403852",
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  fontWeight: 500,
  color: "rgba(64, 56, 82, 0.5)",
  margin: 0,
};

// Left nav
const leftNavStyle: React.CSSProperties = {
  position: "fixed",
  left: 16,
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const navItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px 0",
  transition: "opacity 0.2s",
  fontFamily: '"Manrope", sans-serif',
};

const navDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const navLabelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#403852",
};

// Right dots — section indicators
const rightDotsStyle: React.CSSProperties = {
  position: "fixed",
  right: 20,
  top: 80,
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const rightDotBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const rightDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  transition: "all 0.3s ease",
};

// Bottom input
const bottomContentStyle: React.CSSProperties = {
  width: "min(90%, 560px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
};

const taglineStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.88rem",
  fontWeight: 500,
  color: "rgba(64, 56, 82, 0.6)",
  textAlign: "center",
};

const inputRowStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "14px 18px",
  borderRadius: 16,
  border: "1px solid rgba(255, 255, 255, 0.7)",
  background: "rgba(255, 255, 255, 0.55)",
  backdropFilter: "blur(20px) saturate(140%)",
  boxShadow: "0 8px 24px rgba(112, 101, 145, 0.08)",
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.92rem",
  color: "#403852",
  outline: "none",
};

const sendButtonStyle: React.CSSProperties = {
  padding: "14px 24px",
  border: 0,
  borderRadius: 16,
  background: "linear-gradient(180deg, #7e87df, #646dcb)",
  color: "white",
  fontSize: "0.85rem",
  fontWeight: 700,
  letterSpacing: "0.02em",
  boxShadow: "0 8px 20px rgba(101, 111, 208, 0.2)",
  fontFamily: '"Manrope", sans-serif',
  transition: "opacity 0.2s",
  flexShrink: 0,
};

// Brand
const brandStyle: React.CSSProperties = {
  position: "fixed",
  top: 20,
  left: 20,
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const brandMarkStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 12,
  background: `
    radial-gradient(circle at 28% 26%, rgba(255, 255, 255, 0.94), transparent 28%),
    linear-gradient(155deg, rgba(120, 131, 225, 0.9), rgba(238, 194, 210, 0.84))
  `,
  boxShadow:
    "inset 0 1px 0 rgba(255, 255, 255, 0.76), 0 10px 24px rgba(113, 123, 214, 0.15)",
};

const brandTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 800,
  letterSpacing: "0.02em",
};
