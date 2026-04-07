"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { NavShell } from "@/components/NavShell";
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "@/registry/magicui/scroll-based-velocity";

gsap.registerPlugin(ScrollTrigger);

const ParticleBackground = dynamic(
  () => import("@/components/scene/ParticleBackground"),
  { ssr: false }
);

const SECTIONS = [
  { id: "dream", label: "Dream" },
  { id: "journey", label: "Journey" },
  { id: "awaken", label: "Awaken" },
  { id: "community", label: "Community" },
];

const SAMPLE_DREAMS = [
  [
    "I was falling but the ground never came",
    "My teeth crumbled into sand",
    "A door I couldn\u2019t open kept appearing",
    "I flew over a city made of glass",
  ],
  [
    "I spoke a language I\u2019ve never learned",
    "The ocean was inside my house",
    "A stranger knew my name",
    "I was late but couldn\u2019t find the place",
    "My childhood home had new rooms",
  ],
  [
    "I watched myself from above",
    "Animals were speaking to me",
    "A clock with no hands",
    "I was underwater and could breathe",
  ],
];

const DREAMS_ROW_A = [
  { id: 1, text: "I was flying over an ocean made entirely of mirrors, each one reflecting a different version of myself.", dreamer: "Luna M.", tag: "lucid" },
  { id: 2, text: "A staircase that kept growing taller with each step. I never reached the top but I wasn\u2019t afraid.", dreamer: "Atlas K.", tag: "recurring" },
  { id: 3, text: "My grandmother\u2019s house, but all the doors opened into forests. She was sitting in a clearing, young again.", dreamer: "Sable R.", tag: "visitation" },
  { id: 4, text: "Teeth falling out one by one into my hands. They turned into small white birds and flew away.", dreamer: "Orion J.", tag: "anxiety" },
  { id: 5, text: "A voice kept calling my name from behind a door I couldn\u2019t open. When I finally did, it was my own voice.", dreamer: "Cleo V.", tag: "shadow" },
];

const DREAMS_ROW_B = [
  { id: 6, text: "I was underwater but could breathe perfectly. The fish spoke in languages I somehow understood.", dreamer: "Iris W.", tag: "lucid" },
  { id: 7, text: "A train station where every platform led to a different year of my life. I kept choosing the wrong one.", dreamer: "Felix D.", tag: "time" },
  { id: 8, text: "The moon cracked open like an egg. Something golden poured down and covered everything in warmth.", dreamer: "Nova S.", tag: "cosmic" },
  { id: 9, text: "I was teaching a class but realized I was the student. Everyone else already knew the answer.", dreamer: "Sage T.", tag: "recurring" },
  { id: 10, text: "Every mirror in the house showed someone else\u2019s face. They all smiled when I stopped looking.", dreamer: "Juno A.", tag: "identity" },
];

export default function LandingPage() {
  const [dream, setDream] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [dissolveAmount, setDissolveAmount] = useState(0);
  const [btnHover, setBtnHover] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const particleScopeRef = useRef<HTMLDivElement>(null);
  const communityRef = useRef<HTMLDivElement>(null);
  const sphereWrapperRef = useRef<HTMLDivElement>(null); // kept for potential future use

  const handleSubmit = useCallback(() => {
    if (!dream.trim()) return;
    setSubmitted(true);
    sessionStorage.setItem("dreamrag_dream", dream.trim());
    setTimeout(() => router.push("/dashboard"), 600);
  }, [dream, router]);

  // ScrollTrigger #1: particle morph (sections 1-3)
  useEffect(() => {
    let progressRef: { value: number } | null = null;
    let dissolveRef: { value: number } | null = null;
    import("@/components/scene/ParticleBackground").then((mod) => {
      progressRef = (mod as any).scrollProgress;
      dissolveRef = (mod as any).dissolveProgress;
    });

    const scope = particleScopeRef.current;
    if (!scope) return;

    const DISSOLVE_END = 1 / 3;
    const trigger = ScrollTrigger.create({
      trigger: scope,
      start: "top top",
      end: "bottom bottom",
      scrub: 1.5,
      onUpdate: (self) => {
        const raw = self.progress;
        let morphProgress: number;
        let dissolve: number;

        if (raw < DISSOLVE_END) {
          dissolve = raw / DISSOLVE_END;
          morphProgress = 0;
        } else {
          dissolve = 1;
          morphProgress = ((raw - DISSOLVE_END) / (1 - DISSOLVE_END)) * 2;
        }

        if (progressRef) progressRef.value = morphProgress;
        if (dissolveRef) dissolveRef.value = dissolve;
        setDissolveAmount(dissolve);

        if (raw < 0.33) setActiveSection(0);
        else if (raw < 0.66) setActiveSection(1);
        else setActiveSection(2);
      },
    });

    return () => {
      trigger.kill();
    };
  }, []);

  // Set activeSection to 3 when community section is in view (no sphere movement)
  useEffect(() => {
    const community = communityRef.current;
    if (!community) return;

    const trigger = ScrollTrigger.create({
      trigger: community,
      start: "top 60%",
      end: "bottom top",
      onEnter: () => setActiveSection(3),
      onLeaveBack: () => setActiveSection(2),
    });

    return () => {
      trigger.kill();
    };
  }, []);

  const scrollToSection = (index: number) => {
    const vh = window.innerHeight;
    const offsets = [0, vh * 2, vh * 3, vh * 4];
    window.scrollTo({ top: offsets[index] ?? 0, behavior: "smooth" });
  };

  const glowOpacity = inputFocused ? 0.4 : 0.14;

  return (
    <div ref={scrollContainerRef} style={rootStyle}>
      {/* Gradient backdrop */}
      <div style={gradientStyle} />

      {/* 3D particles — fixed, with sphere shrink wrapper */}
      <div ref={sphereWrapperRef} style={sphereWrapperStyle}>
        {/* Loading indicator — sits behind particles, covered by their fade-in */}
        <div style={loaderBackdropStyle}>
          <div style={loaderOrbStyle}>
            <div style={loaderRingOuterStyle} />
            <div style={loaderRingInnerStyle} />
            <div style={loaderDotStyle} />
          </div>
          <p style={loaderTextStyle}>Summoning the unconscious</p>
          <style>{`
            @keyframes loaderSpin {
              to { transform: rotate(360deg); }
            }
            @keyframes loaderSpinReverse {
              to { transform: rotate(-360deg); }
            }
            @keyframes loaderPulse {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.6); opacity: 1; }
            }
            @keyframes loaderFadeOut {
              0%, 80% { opacity: 1; }
              100% { opacity: 0; pointer-events: none; }
            }
            @keyframes loaderTextFade {
              0%, 100% { opacity: 0.35; }
              50% { opacity: 0.7; }
            }
          `}</style>
        </div>
        <ParticleBackground />
      </div>

      {/* Shared nav — brand pill + left dot nav */}
      <NavShell />

      {/* Right edge dots — scroll section indicators (landing-only) */}
      <div style={rightDotsStyle}>
        {SECTIONS.map((section, i) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(i)}
            onMouseEnter={() => setHoveredDot(i)}
            onMouseLeave={() => setHoveredDot(null)}
            style={rightDotBtnStyle}
            type="button"
            title={section.label}
          >
            <span
              style={{
                ...rightDotLabelStyle,
                opacity: hoveredDot === i ? 0.6 : 0,
                transform:
                  hoveredDot === i ? "translateX(0)" : "translateX(4px)",
              }}
            >
              {section.label}
            </span>
            <span
              style={{
                ...rightDotStyle,
                background:
                  activeSection === i
                    ? "linear-gradient(180deg, #b6d5ff, #6b75d4)"
                    : "rgba(64, 56, 82, 0.2)",
                transform:
                  activeSection === i
                    ? "scale(1.5)"
                    : hoveredDot === i
                      ? "scale(1.3)"
                      : "scale(1)",
                boxShadow:
                  activeSection === i
                    ? "0 0 8px rgba(107, 117, 212, 0.4)"
                    : "none",
              }}
            />
          </button>
        ))}
      </div>

      {/* ── Particle scope: sections 1-3 ── */}
      <div ref={particleScopeRef} style={particleScopeStyle}>
        {/* Section 1 — Dream input, pinned during dissolve */}
        <div style={dissolveWrapperStyle}>
          <section style={stickySection1Style}>
            {/* Phase 1: Hero heading — right-aligned */}
            <div
              style={{
                ...heroTextStyle,
                opacity: submitted
                  ? 0
                  : Math.max(0, 1 - dissolveAmount * 2.5),
                transform: `translateY(${dissolveAmount * -30}px)`,
                pointerEvents:
                  dissolveAmount > 0.4
                    ? ("none" as const)
                    : ("auto" as const),
              }}
            >
              <h1 style={heroHeadingStyle}>What did you dream?</h1>
              <p style={heroSubStyle}>
                AI dream analysis powered by Jung, Freud &amp; 10,000 dreamers
              </p>
            </div>

            {/* Phase 2: Particle-stage atmospheric text */}
            <div
              style={{
                ...heroTextStyle,
                opacity: submitted
                  ? 0
                  : Math.max(0, Math.min(1, (dissolveAmount - 0.3) * 3)),
                transform: `translateY(${Math.max(0, (1 - dissolveAmount) * 20)}px)`,
                pointerEvents: "none" as const,
              }}
            >
              <p style={particleHeadingStyle}>The symbols scatter</p>
              <p style={particleSubStyle}>
                Your dream is entering the machine
              </p>
            </div>

            {/* Sample dream pills — slide away as you scroll */}
            <div
              style={{
                ...sampleWallStyle,
                opacity: submitted
                  ? 0
                  : dissolveAmount < 0.25
                    ? 0
                    : dissolveAmount > 0.8
                      ? Math.max(0, 1 - (dissolveAmount - 0.8) * 5)
                      : Math.min(1, (dissolveAmount - 0.25) * 3),
                pointerEvents:
                  dissolveAmount < 0.3 || dissolveAmount > 0.85 || submitted
                    ? ("none" as const)
                    : ("auto" as const),
              }}
            >
              {SAMPLE_DREAMS.map((row, ri) => {
                const direction = ri % 2 === 0 ? -1 : 1;
                const speed = 80 + ri * 30;
                const slideX = direction * dissolveAmount * speed;
                return (
                  <div
                    key={ri}
                    style={{
                      ...sampleRowStyle,
                      transform: `translateX(${slideX}px)`,
                    }}
                  >
                    {row.map((text) => (
                      <button
                        key={text}
                        type="button"
                        onClick={() => setDream(text)}
                        style={samplePillStyle}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Input — always visible, right-aligned */}
            <div
              style={{
                ...inputContainerStyle,
                opacity: submitted ? 0 : 1,
                transform: submitted ? "translateY(20px)" : "translateY(0)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
              }}
            >
              <div
                style={{
                  ...inputGlassStyle,
                  boxShadow: `
                    0 0 0 1px rgba(126, 135, 223, ${glowOpacity}),
                    0 0 ${inputFocused ? 28 : 14}px rgba(126, 135, 223, ${glowOpacity * 0.6}),
                    0 8px 32px rgba(0, 0, 0, 0.1),
                    inset 0 1px 0 rgba(255, 255, 255, 0.06)
                  `,
                }}
              >
                <input
                  autoFocus
                  value={dream}
                  onChange={(e) => setDream(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
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
                  onMouseEnter={() => setBtnHover(true)}
                  onMouseLeave={() => setBtnHover(false)}
                  style={{
                    ...sendBtnStyle,
                    borderColor:
                      btnHover && dream.trim()
                        ? "rgba(126, 135, 223, 0.6)"
                        : "rgba(126, 135, 223, 0.25)",
                    background:
                      btnHover && dream.trim()
                        ? "rgba(126, 135, 223, 0.2)"
                        : "rgba(126, 135, 223, 0.08)",
                    boxShadow:
                      btnHover && dream.trim()
                        ? "0 0 16px rgba(126, 135, 223, 0.3)"
                        : "none",
                    opacity: dream.trim() ? 1 : 0.25,
                    cursor: dream.trim() ? "pointer" : "default",
                    transform:
                      btnHover && dream.trim()
                        ? "translateY(-1px)"
                        : "translateY(0)",
                  }}
                  type="button"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
                    <path
                      d="M1.5 7h11M8.5 3l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <p
                style={{
                  ...inputHintStyle,
                  opacity: dream.trim() ? 0.45 : 0.25,
                }}
              >
                {dream.trim() ? "press enter to analyze" : "describe your dream"}
              </p>
            </div>
          </section>
        </div>

        {/* Section 2 — Journey */}
        <section style={sectionStyle}>
          <div style={sectionTextStyle}>
            <p style={sectionHeadingStyle}>Ancient symbols, modern mind</p>
            <p style={sectionSubStyle}>
              AI maps your dream against Jung, Freud, and 10,000
              dreamers&apos; patterns.
            </p>
          </div>
        </section>

        {/* Section 3 — Awaken */}
        <section style={sectionStyle}>
          <div style={sectionTextStyle}>
            <p style={sectionHeadingStyle}>Your unconscious, decoded</p>
            <p style={sectionSubStyle}>
              Recurring themes. Archetypal echoes. A mirror you can read.
            </p>
          </div>
        </section>
      </div>

      {/* ── Section 4 — Community dreams, velocity scroll ── */}
      <section ref={communityRef} style={communityWrapperStyle}>
        <div style={communityHeaderStyle}>
          <p style={sectionHeadingStyle}>Dreams from the collective</p>
          <p style={sectionSubStyle}>
            Real dreams, analyzed by DreamRAG
          </p>
        </div>

        <ScrollVelocityContainer className="w-full">
          <ScrollVelocityRow baseVelocity={4} direction={1} className="py-3">
            {DREAMS_ROW_A.map((d) => (
              <div key={d.id} style={dreamCardStyle}>
                <span style={cardTagStyle}>{d.tag}</span>
                <p style={cardTextStyle}>&ldquo;{d.text}&rdquo;</p>
                <p style={cardDreamerStyle}>{d.dreamer}</p>
              </div>
            ))}
          </ScrollVelocityRow>
          <ScrollVelocityRow baseVelocity={3} direction={-1} className="py-3">
            {DREAMS_ROW_B.map((d) => (
              <div key={d.id} style={dreamCardStyle}>
                <span style={cardTagStyle}>{d.tag}</span>
                <p style={cardTextStyle}>&ldquo;{d.text}&rdquo;</p>
                <p style={cardDreamerStyle}>{d.dreamer}</p>
              </div>
            ))}
          </ScrollVelocityRow>
        </ScrollVelocityContainer>

        {/* Edge fades — prevent cards from overlapping nav */}
        <div style={edgeFadeLeftStyle} />
        <div style={edgeFadeRightStyle} />
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

// Sphere wrapper — animated via ref (no React re-render)
const sphereWrapperStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
  transformOrigin: "center center",
  willChange: "transform, opacity",
};

// Particle scope — wraps sections 1-3 for the particle ScrollTrigger
const particleScopeStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 10,
};

const dissolveWrapperStyle: React.CSSProperties = {
  position: "relative",
  height: "200vh",
};

const stickySection1Style: React.CSSProperties = {
  position: "sticky",
  top: 0,
  height: "100vh",
};

// ── Hero text — right-aligned, clear of 3D mesh ──
const heroTextStyle: React.CSSProperties = {
  position: "absolute",
  top: "30%",
  right: "8%",
  width: "min(38vw, 440px)",
  textAlign: "left",
};

const heroHeadingStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "3.8rem",
  fontWeight: 300,
  fontStyle: "italic",
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
  margin: "0 0 14px 0",
  color: "#403852",
};

const heroSubStyle: React.CSSProperties = {
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.82rem",
  fontWeight: 400,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "rgba(64, 56, 82, 0.52)",
  margin: 0,
};

const particleHeadingStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "2.6rem",
  fontWeight: 300,
  fontStyle: "italic",
  letterSpacing: "-0.01em",
  lineHeight: 1.2,
  margin: "0 0 10px 0",
  color: "rgba(64, 56, 82, 0.75)",
};

const particleSubStyle: React.CSSProperties = {
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.82rem",
  fontWeight: 400,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "rgba(64, 56, 82, 0.48)",
  margin: 0,
};

// ── Input — right-aligned, always visible ──
const inputContainerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 52,
  right: "8%",
  width: "min(38vw, 440px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
  zIndex: 15,
};

const inputGlassStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  alignItems: "center",
  gap: 0,
  padding: 4,
  borderRadius: 22,
  background: "rgba(30, 26, 42, 0.55)",
  backdropFilter: "blur(24px) saturate(150%)",
  border: "1px solid rgba(126, 135, 223, 0.18)",
  transition: "box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 18,
  border: "none",
  background: "transparent",
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.95rem",
  fontWeight: 400,
  color: "rgba(235, 230, 245, 1)",
  outline: "none",
  letterSpacing: "0.01em",
};

// Send button — ring style with SVG arrow
const sendBtnStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  border: "1.5px solid rgba(126, 135, 223, 0.25)",
  borderRadius: 14,
  background: "rgba(126, 135, 223, 0.08)",
  color: "rgba(200, 195, 220, 0.8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  margin: 2,
};

const inputHintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.72rem",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "rgba(64, 56, 82, 0.55)",
  transition: "opacity 0.3s ease",
  paddingLeft: 4,
};

// ── Sample dream pills ──
const sampleWallStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 200,
  right: "4%",
  width: "min(52vw, 600px)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  zIndex: 15,
  overflow: "hidden",
};

const sampleRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "nowrap",
  transition: "transform 0.15s ease-out",
  justifyContent: "flex-start",
  overflow: "visible",
};

const samplePillStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "5px 12px",
  borderRadius: 14,
  border: "1px solid rgba(126, 135, 223, 0.15)",
  background: "rgba(30, 26, 42, 0.35)",
  backdropFilter: "blur(12px)",
  color: "rgba(200, 195, 220, 0.75)",
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.02em",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.25s ease",
};

// ── Sections 2 & 3 ──
const sectionStyle: React.CSSProperties = {
  position: "relative",
  height: "100vh",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  paddingBottom: 48,
};

const sectionTextStyle: React.CSSProperties = {
  textAlign: "center",
  maxWidth: 420,
};

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "2.6rem",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  lineHeight: 1.15,
  margin: "0 0 12px 0",
  color: "#403852",
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 400,
  color: "rgba(64, 56, 82, 0.6)",
  lineHeight: 1.6,
  margin: 0,
};

// ── Section 4: community dreams velocity scroll ──
const communityWrapperStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 10,
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 28,
  paddingTop: 80,
  paddingBottom: 80,
  overflow: "hidden",
};

const communityHeaderStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: 8,
};

const edgeFadeLeftStyle: React.CSSProperties = {
  position: "absolute",
  inset: "0 auto 0 0",
  width: 100,
  background: "linear-gradient(to right, rgba(208, 200, 192, 0.95), transparent)",
  pointerEvents: "none",
  zIndex: 2,
};

const edgeFadeRightStyle: React.CSSProperties = {
  position: "absolute",
  inset: "0 0 0 auto",
  width: 100,
  background: "linear-gradient(to left, rgba(208, 200, 192, 0.95), transparent)",
  pointerEvents: "none",
  zIndex: 2,
};

const dreamCardStyle: React.CSSProperties = {
  width: 300,
  minHeight: 190,
  flexShrink: 0,
  padding: "24px 24px",
  margin: "0 12px",
  borderRadius: 20,
  background: "rgba(30, 26, 42, 0.48)",
  backdropFilter: "blur(20px) saturate(140%)",
  border: "1px solid rgba(126, 135, 223, 0.12)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  whiteSpace: "normal" as const,
};

const cardTagStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  fontSize: "0.66rem",
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  padding: "4px 10px",
  borderRadius: 8,
  background: "rgba(126, 135, 223, 0.12)",
  border: "1px solid rgba(126, 135, 223, 0.15)",
  color: "rgba(200, 195, 225, 0.95)",
};

const cardTextStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "1.12rem",
  fontWeight: 400,
  fontStyle: "italic",
  lineHeight: 1.5,
  color: "rgba(230, 225, 240, 0.95)",
  margin: 0,
  flex: 1,
};

const cardDreamerStyle: React.CSSProperties = {
  fontSize: "0.74rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "rgba(190, 185, 210, 0.75)",
  margin: 0,
};

// ── Right dots ──
const rightDotsStyle: React.CSSProperties = {
  position: "fixed",
  right: 20,
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const rightDotBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px 0",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
};

const rightDotLabelStyle: React.CSSProperties = {
  fontSize: "0.6rem",
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "#403852",
  transition: "all 0.25s ease",
  whiteSpace: "nowrap" as const,
};

// ── Loader (behind 3D canvas) ──
const loaderBackdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 20,
  zIndex: 0,
  animation: "loaderFadeOut 4s ease-out 2.5s forwards",
};

const loaderOrbStyle: React.CSSProperties = {
  position: "relative",
  width: 72,
  height: 72,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginLeft: "-12vw",
  marginTop: "-4vh",
};

const loaderRingOuterStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  border: "2px solid transparent",
  borderTopColor: "rgba(107, 117, 212, 0.6)",
  borderRightColor: "rgba(182, 213, 255, 0.3)",
  animation: "loaderSpin 1.6s linear infinite",
};

const loaderRingInnerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 10,
  borderRadius: "50%",
  border: "1.5px solid transparent",
  borderBottomColor: "rgba(182, 213, 255, 0.5)",
  borderLeftColor: "rgba(126, 135, 223, 0.2)",
  animation: "loaderSpinReverse 2.4s linear infinite",
};

const loaderDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(182, 213, 255, 1), rgba(107, 117, 212, 0.5))",
  boxShadow: "0 0 12px rgba(107, 117, 212, 0.4)",
  animation: "loaderPulse 2s ease-in-out infinite",
};

const loaderTextStyle: React.CSSProperties = {
  margin: 0,
  marginLeft: "-12vw",
  marginTop: "-2vh",
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "1.05rem",
  fontWeight: 400,
  fontStyle: "italic",
  letterSpacing: "0.04em",
  color: "rgba(64, 56, 82, 0.45)",
  animation: "loaderTextFade 2.5s ease-in-out infinite",
};

const rightDotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  flexShrink: 0,
};

