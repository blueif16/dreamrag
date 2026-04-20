"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MeshGradient } from "@paper-design/shaders-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { NavShell } from "@/components/NavShell";
import { triggerPageTransition } from "@/components/TransitionOverlay";
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "@/registry/magicui/scroll-based-velocity";

gsap.registerPlugin(ScrollTrigger);

const CloudModel = dynamic(
  () => import("@/components/scene/CloudModel"),
  { ssr: false }
);

const SECTIONS = [
  { id: "dream", label: "Dream" },
  { id: "journey", label: "Journey" },
  { id: "awaken", label: "Awaken" },
  { id: "community", label: "Community" },
];

// Three flows the orchestrator supports (graph.py:242-288): dream analysis,
// symbol lookup, temporal/pattern view. Each mode retargets heading, chips,
// and placeholder so users discover all three entry points.
type Mode = "dream" | "symbol" | "patterns";

const MODES: {
  id: Mode;
  label: string;
  heading: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    id: "dream",
    label: "Share a dream",
    heading: "What did you dream?",
    hint: "AI dream analysis powered by Jung, Freud \u0026 10,000 dreamers",
    placeholder: "Last night I walked through deep water...",
  },
  {
    id: "symbol",
    label: "Ask a symbol",
    heading: "Which symbol calls you?",
    hint: "Decode a single image through 10,000 dreams of meaning",
    placeholder: "What does water mean in dreams?",
  },
  {
    id: "patterns",
    label: "See patterns",
    heading: "What do your dreams reveal?",
    hint: "Rhythm, recurrence, and the shape of your dreaming",
    placeholder: "Show the rhythm of my dreaming...",
  },
];

const MODE_SAMPLES: Record<Mode, string[]> = {
  dream: [
    "I was falling but the ground never came",
    "My teeth crumbled into sand",
    "A door I couldn\u2019t open kept appearing",
    "I flew over a city made of glass",
    "The ocean was inside my house",
    "A stranger knew my name",
    "My childhood home had new rooms",
    "I watched myself from above",
  ],
  symbol: [
    "What does water mean?",
    "Doors that won\u2019t open",
    "Teeth falling out",
    "Mirrors in dreams",
    "Why am I always falling?",
    "Flying — what it means",
    "Snakes in dreams",
    "The childhood home symbol",
  ],
  patterns: [
    "Show my dream patterns",
    "When do I dream most?",
    "Symbols that keep returning",
    "How has my dreaming shifted?",
    "Emotions I dream in",
    "My monthly rhythm",
    "Recurring themes",
    "How often I dream",
  ],
};

// Scattered positions around viewport edges — avoids center where cloud sits
// [left%, top%, float-delay-s, float-duration-s]
const PILL_POSITIONS: [number, number, number, number][] = [
  // top-left arc
  [6, 12, 0, 6.2],
  [18, 6, 1.3, 7.1],
  // left side — staggered depths
  [2, 34, 0.8, 5.8],
  [11, 55, 1.6, 6.9],
  [4, 78, 0.3, 7.3],
  // bottom band
  [24, 90, 1.1, 5.9],
  [62, 92, 0.6, 6.4],
  // right side — staggered depths
  [88, 22, 1.2, 6.5],
  [79, 42, 0.5, 7.4],
  [91, 60, 1.9, 5.6],
  [83, 80, 0.7, 6.8],
  // top-right arc
  [72, 5, 0.2, 7.0],
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

const HEATMAP_DATA = [
  0, 1, 0, 2, 1, 0, 3, 1, 0, 2, 0,
  2, 0, 3, 0, 1, 4, 0, 2, 0, 1, 2,
  0, 1, 0, 2, 0, 3, 1, 0, 2, 4, 1,
  1, 0, 2, 1, 3, 0, 1, 2, 0, 1, 0,
];

const HEAT_COLORS = [
  "rgba(255, 255, 255, 0.45)",
  "rgba(203, 236, 224, 0.78)",
  "rgba(208, 215, 255, 0.82)",
  "rgba(246, 208, 220, 0.84)",
  "rgba(234, 199, 137, 0.84)",
];

// Original orb data — colored pearls scattered around the core
const ATMO_ORBS = [
  { label: "Falling", top: "25%", left: "17%",
    core: "rgba(180, 170, 210, 0.72)", coreFade: "rgba(180, 170, 210, 0.22)",
    glow: "rgba(165, 155, 200, 0.7)", glowMid: "rgba(165, 155, 200, 0.45)", glowFade: "rgba(165, 155, 200, 0.18)" },
  { label: "Mother", top: "22%", left: "59%",
    core: "rgba(210, 185, 195, 0.74)", coreFade: "rgba(210, 185, 195, 0.24)",
    glow: "rgba(200, 170, 185, 0.7)", glowMid: "rgba(200, 170, 185, 0.45)", glowFade: "rgba(200, 170, 185, 0.18)" },
  { label: "House", top: "40%", left: "75%",
    core: "rgba(205, 200, 175, 0.74)", coreFade: "rgba(205, 200, 175, 0.24)",
    glow: "rgba(195, 188, 160, 0.7)", glowMid: "rgba(195, 188, 160, 0.45)", glowFade: "rgba(195, 188, 160, 0.18)" },
  { label: "Running", top: "58%", left: "68%",
    core: "rgba(175, 200, 195, 0.74)", coreFade: "rgba(175, 200, 195, 0.24)",
    glow: "rgba(160, 190, 185, 0.7)", glowMid: "rgba(160, 190, 185, 0.45)", glowFade: "rgba(160, 190, 185, 0.18)" },
  { label: "Night", top: "62%", left: "23%",
    core: "rgba(170, 190, 215, 0.74)", coreFade: "rgba(170, 190, 215, 0.24)",
    glow: "rgba(155, 175, 205, 0.7)", glowMid: "rgba(155, 175, 205, 0.45)", glowFade: "rgba(155, 175, 205, 0.18)" },
];

// Constellation nodes (unused — kept for reference)
const ATMO_NODES: { label: string; x: number; y: number }[] = [
  { label: "Falling",  x: 14, y: 20 },
  { label: "Mother",   x: 60, y: 14 },
  { label: "House",    x: 84, y: 36 },
  { label: "Running",  x: 78, y: 70 },
  { label: "Night",    x: 18, y: 66 },
  { label: "Mirror",   x: 46, y: 86 },
];
const ATMO_CENTER = { x: 50, y: 50 };

// Per-section color palettes — very pale, near-white with just a whisper of hue
// so the mesh reads as "colors drifting inside frosted glass"
const SECTION_PALETTES: [string, string, string, string][] = [
  ["#F2ECF7", "#ECF2F7", "#F7ECF1", "#EDF2F7"], // journey — barely lavender / barely sky
  ["#EEF5F1", "#F5F1E8", "#F7EFE6", "#E8F1EB"], // awaken — barely sage / barely cream
  ["#EAEFF6", "#E2E6F0", "#EFEAF5", "#EBEFF3"], // community — barely twilight
];

// Hex color interpolation helper
function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function lerpPalette(
  a: [string, string, string, string],
  b: [string, string, string, string],
  t: number,
): [string, string, string, string] {
  return [
    lerpColor(a[0], b[0], t),
    lerpColor(a[1], b[1], t),
    lerpColor(a[2], b[2], t),
    lerpColor(a[3], b[3], t),
  ];
}

export default function LandingPage() {
  const [dream, setDream] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [btnHover, setBtnHover] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);
  const [meshColors, setMeshColors] = useState<[string, string, string, string]>(SECTION_PALETTES[0]);
  const [chipOffset, setChipOffset] = useState(0);
  const [headingHover, setHeadingHover] = useState(false);
  const [absorbingChip, setAbsorbingChip] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("dream");
  // Lagged mirror of `mode` — holds current heading/hint/placeholder so we can
  // orchestrate an out→swap→in crossfade instead of an abrupt remount.
  const [displayedMode, setDisplayedMode] = useState<Mode>("dream");
  const [textPhase, setTextPhase] = useState<"in" | "out">("in");
  const currentMode = MODES.find((m) => m.id === displayedMode)!;
  const samples = MODE_SAMPLES[displayedMode];
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const cloudMoverRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const journeyRef = useRef<HTMLElement>(null);
  const awakenRef = useRef<HTMLElement>(null);
  const communityRef = useRef<HTMLElement>(null);
  const journeyTextRef = useRef<HTMLDivElement>(null);
  const journeyAtmoRef = useRef<HTMLDivElement>(null);
  const awakenTextRef = useRef<HTMLDivElement>(null);
  const awakenHeatRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<HTMLDivElement>(null);
  const orbFogRef = useRef<HTMLDivElement>(null);

  // Prefetch dashboard so navigation is near-instant
  useEffect(() => { router.prefetch("/dashboard"); }, [router]);

  // Rotate prompt chips every 8s until the user engages
  useEffect(() => {
    if (submitted || dream || inputFocused) return;
    const id = setInterval(() => {
      setChipOffset((prev) => (prev + 4) % samples.length);
    }, 8000);
    return () => clearInterval(id);
  }, [submitted, dream, inputFocused, samples.length]);

  // Reset rotation when mode changes
  useEffect(() => {
    setChipOffset(0);
  }, [mode]);

  // Crossfade heading/hint/placeholder on mode change: fade out, swap, fade in.
  useEffect(() => {
    if (mode === displayedMode) return;
    setTextPhase("out");
    const t = setTimeout(() => {
      setDisplayedMode(mode);
      setTextPhase("in");
    }, 190);
    return () => clearTimeout(t);
  }, [mode, displayedMode]);

  const handleChipClick = useCallback((slot: number, text: string) => {
    setAbsorbingChip(slot);
    setTimeout(() => {
      setDream(text);
      setAbsorbingChip(null);
      inputRef.current?.focus();
    }, 260);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!dream.trim()) return;
    setSubmitted(true);
    sessionStorage.setItem("dreamrag_dream", dream.trim());
    triggerPageTransition();
    // Brief content fade, then navigate — body bg bridges the gap
    setTimeout(() => router.push("/dashboard"), 350);
  }, [dream, router]);

  // Mouse tracking for cloud model
  useEffect(() => {
    let target: { x: number; y: number } | null = null;
    import("@/components/scene/CloudModel").then((mod) => {
      target = mod.mouseTarget;
    });
    const handler = (e: MouseEvent) => {
      if (!target) return;
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // GSAP: cloud flow + section text reveals + section tracking
  useEffect(() => {
    const cloudEl = cloudMoverRef.current;
    const heroContent = heroContentRef.current;
    const inputContainer = inputContainerRef.current;
    const journey = journeyRef.current;
    const awaken = awakenRef.current;
    const community = communityRef.current;
    const journeyText = journeyTextRef.current;
    const journeyAtmo = journeyAtmoRef.current;
    const awakenText = awakenTextRef.current;
    const awakenHeat = awakenHeatRef.current;
    const meshEl = meshRef.current;
    if (!cloudEl || !journey || !community) return;

    const triggers: ScrollTrigger[] = [];

    // Initial fade-in
    gsap.fromTo(cloudEl, { opacity: 0 }, {
      opacity: 1, duration: 2.2, ease: "power2.out", delay: 0.4,
    });

    // ── Hero content fades out as you scroll toward Journey ──
    if (heroContent && inputContainer) {
      triggers.push(ScrollTrigger.create({
        trigger: journey,
        start: "top 100%",
        end: "top 60%",
        scrub: 1,
        onUpdate: (self) => {
          const p = self.progress;
          heroContent.style.opacity = String(1 - p);
          heroContent.style.transform = `translateY(${-30 * p}px)`;
          inputContainer.style.opacity = String(1 - p);
          inputContainer.style.transform = `translateY(${20 * p}px)`;
        },
      }));
    }

    // ── Hero → Journey: cloud recedes (lift + scale + fade), mesh fades in ──
    triggers.push(ScrollTrigger.create({
      trigger: journey,
      start: "top 100%",
      end: "top 60%",
      scrub: 1,
      onUpdate: (self) => {
        gsap.killTweensOf(cloudEl, "opacity");
        const p = self.progress;
        cloudEl.style.opacity = String(1 - p);
        // Subtle depth recession — cloud lifts and shrinks as user descends.
        cloudEl.style.setProperty("--cloud-scroll-y", `${-5 * p}vh`);
        cloudEl.style.setProperty("--cloud-scroll-scale", `${1 - 0.14 * p}`);
        if (meshEl) meshEl.style.opacity = String(p);
      },
    }));

    // ── Smooth color interpolation: Journey → Awaken ──
    if (awaken) {
      triggers.push(ScrollTrigger.create({
        trigger: awaken,
        start: "top 100%",
        end: "top 40%",
        scrub: 1,
        onUpdate: (self) => {
          setMeshColors(lerpPalette(SECTION_PALETTES[0], SECTION_PALETTES[1], self.progress));
        },
      }));
    }

    // ── Smooth color interpolation: Awaken → Community ──
    triggers.push(ScrollTrigger.create({
      trigger: community,
      start: "top 100%",
      end: "top 40%",
      scrub: 1,
      onUpdate: (self) => {
        setMeshColors(lerpPalette(SECTION_PALETTES[1], SECTION_PALETTES[2], self.progress));
      },
    }));

    // Journey text (top-left): slide in from further left
    if (journeyText) {
      gsap.set(journeyText, { opacity: 0 });
      triggers.push(ScrollTrigger.create({
        trigger: journey,
        start: "top 70%",
        end: "top 25%",
        scrub: 1,
        onUpdate: (self) => {
          const p = self.progress;
          journeyText.style.opacity = String(Math.min(p * 2, 1));
          journeyText.style.transform = `translateX(${-50 * (1 - p)}px)`;
        },
      }));
    }

    // Orb fog (bottom-right): soft frosted halo that pops the orbs off the mesh
    if (orbFogRef.current) {
      const fog = orbFogRef.current;
      gsap.set(fog, { opacity: 0 });
      triggers.push(ScrollTrigger.create({
        trigger: journey,
        start: "top 80%",
        end: "top 30%",
        scrub: 1,
        onUpdate: (self) => {
          fog.style.opacity = String(Math.min(self.progress * 1.5, 1));
        },
      }));
    }

    // Journey atmosphere (bottom-right): fade up from below-right
    if (journeyAtmo) {
      gsap.set(journeyAtmo, { opacity: 0 });
      triggers.push(ScrollTrigger.create({
        trigger: journey,
        start: "top 55%",
        end: "top 15%",
        scrub: 1,
        onUpdate: (self) => {
          const p = self.progress;
          journeyAtmo.style.opacity = String(Math.min(p * 1.8, 1));
          journeyAtmo.style.transform = `translate(${40 * (1 - p)}px, ${30 * (1 - p)}px)`;
        },
      }));
    }

    if (awaken) {
      // Awaken text (top-right): slide in from further right
      if (awakenText) {
        gsap.set(awakenText, { opacity: 0 });
        triggers.push(ScrollTrigger.create({
          trigger: awaken,
          start: "top 70%",
          end: "top 25%",
          scrub: 1,
          onUpdate: (self) => {
            const p = self.progress;
            awakenText.style.opacity = String(Math.min(p * 2, 1));
            awakenText.style.transform = `translateX(${50 * (1 - p)}px)`;
          },
        }));
      }

      // Awaken heatmap (bottom-left): fade up from below-left
      if (awakenHeat) {
        gsap.set(awakenHeat, { opacity: 0 });
        triggers.push(ScrollTrigger.create({
          trigger: awaken,
          start: "top 55%",
          end: "top 15%",
          scrub: 1,
          onUpdate: (self) => {
            const p = self.progress;
            awakenHeat.style.opacity = String(Math.min(p * 1.8, 1));
            awakenHeat.style.transform = `translate(${-40 * (1 - p)}px, ${30 * (1 - p)}px)`;
          },
        }));
      }
    }

    // Section tracking for right dots
    triggers.push(ScrollTrigger.create({
      trigger: journey,
      start: "top center",
      onEnter: () => setActiveSection(1),
      onLeaveBack: () => setActiveSection(0),
    }));

    if (awaken) {
      triggers.push(ScrollTrigger.create({
        trigger: awaken,
        start: "top center",
        onEnter: () => setActiveSection(2),
        onLeaveBack: () => setActiveSection(1),
      }));
    }

    triggers.push(ScrollTrigger.create({
      trigger: community,
      start: "top 60%",
      onEnter: () => setActiveSection(3),
      onLeaveBack: () => setActiveSection(2),
    }));

    return () => {
      gsap.killTweensOf(cloudEl);
      triggers.forEach((t) => t.kill());
    };
  }, []);

  const scrollToSection = (index: number) => {
    const vh = window.innerHeight;
    window.scrollTo({ top: vh * index, behavior: "smooth" });
  };

  const glowOpacity = inputFocused ? 0.45 : 0.24;

  return (
    <div style={rootStyle}>
      {/* Float keyframes + orb animations */}
      <style>{`
        @keyframes pillFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-8px) rotate(0.5deg); }
          66% { transform: translateY(4px) rotate(-0.3deg); }
        }
        @keyframes floatNode {
          0% { transform: translateY(0); }
          100% { transform: translateY(-8px); }
        }
        @keyframes pulseDrift {
          0% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-50%, -50%) scale(1.04); }
        }
        @keyframes corePulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes drift {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          100% { transform: translate3d(10px, -8px, 0) scale(1.06); }
        }
        @keyframes twinkle {
          0% { opacity: 0.35; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes heroFade {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes cloudSway {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          33% { transform: translate3d(-4px, -7px, 0) rotate(-0.55deg); }
          66% { transform: translate3d(5px, -3px, 0) rotate(0.45deg); }
        }
      `}</style>

      {/* Original static gradient — hero backdrop */}
      <div style={gradientStyle} />

      {/* Fluid mesh gradient — fades in from section 2 onward */}
      <div ref={meshRef} style={meshWrapperStyle}>
        <MeshGradient
          colors={meshColors}
          speed={0.8}
          distortion={0.7}
          swirl={0.3}
          grainMixer={0}
          grainOverlay={0}
          width="100vw"
          height="100vh"
          fit="cover"
        />
      </div>

      {/* 3D cloud model — fixed, flows through page via GSAP.
          Outer: centering + scroll-driven lift/scale/opacity (via CSS vars).
          Inner: ambient sway loop, independent of scroll. */}
      <div ref={cloudMoverRef} style={cloudWrapperStyle}>
        <div style={cloudSwayStyle}>
          <CloudModel />
        </div>
      </div>

      {/* Nav */}
      <NavShell />

      {/* Right edge dots */}
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

      {/* ── Section 1 — Hero / Dream Input ── */}
      <section style={heroSectionStyle}>
        {/* Scattered floating dream pills — hidden
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 12,
            pointerEvents: "none",
            opacity: submitted ? 0 : 1,
            transition: "opacity 0.6s ease",
          }}
        >
          {SAMPLE_DREAMS.map((text, i) => {
            const [left, top, delay, duration] = PILL_POSITIONS[i];
            return (
              <button
                key={text}
                type="button"
                onClick={() => setDream(text)}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: `${top}%`,
                  pointerEvents: "auto",
                  animation: `pillFloat ${duration}s ease-in-out ${delay}s infinite`,
                  ...scatteredPillStyle,
                }}
              >
                {text}
              </button>
            );
          })}
        </div>
        */}

        {/* Top heading */}
        <div
          ref={heroContentRef}
          onMouseEnter={() => setHeadingHover(true)}
          onMouseLeave={() => setHeadingHover(false)}
          style={{
            ...heroContentStyle,
            opacity: submitted ? 0 : 1,
            transform: submitted ? "translateY(20px)" : "translateY(0)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <h1
            style={{
              ...heroHeadingStyle,
              opacity: textPhase === "in" ? 1 : 0,
              transform: textPhase === "in" ? "translateY(0)" : "translateY(-4px)",
              filter: textPhase === "in" ? "blur(0)" : "blur(2px)",
              transition:
                "opacity 260ms cubic-bezier(0.32, 0.72, 0, 1), transform 260ms cubic-bezier(0.32, 0.72, 0, 1), filter 260ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            {currentMode.heading}
          </h1>
          <p
            style={{
              ...heroSubStyle,
              opacity: textPhase === "in" ? 1 : 0,
              transform: textPhase === "in" ? "translateY(0)" : "translateY(-3px)",
              transition:
                "opacity 260ms 60ms cubic-bezier(0.32, 0.72, 0, 1), transform 260ms 60ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            {currentMode.hint}
          </p>
        </div>

        {/* Mode selector — teaches the 3 flows the orchestrator supports */}
        <div
          style={{
            ...modeTabsStyle,
            opacity: submitted ? 0 : 1,
            pointerEvents: submitted ? "none" : "auto",
          }}
        >
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                style={{
                  ...modeTabStyle,
                  color: active ? "#1a1430" : "rgba(26, 20, 48, 0.55)",
                  background: active
                    ? "rgba(255, 255, 255, 0.45)"
                    : "rgba(255, 255, 255, 0.12)",
                  borderColor: active
                    ? "rgba(126, 135, 223, 0.5)"
                    : "rgba(126, 135, 223, 0.18)",
                  boxShadow: active
                    ? "0 4px 16px rgba(107, 117, 212, 0.15)"
                    : "none",
                }}
              >
                <span
                  style={{
                    ...modeTabDotStyle,
                    background: active
                      ? "linear-gradient(180deg, #b6d5ff, #6b75d4)"
                      : "rgba(42, 35, 64, 0.3)",
                    boxShadow: active
                      ? "0 0 8px rgba(107, 117, 212, 0.4)"
                      : "none",
                  }}
                />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Prompt chips — bridge between heading and input */}
        <div
          style={{
            ...chipRowStyle,
            opacity: submitted ? 0 : inputFocused || dream ? 0.22 : 1,
            transform: `translateY(${inputFocused || dream ? 4 : 0}px)`,
            pointerEvents: inputFocused || dream || submitted ? "none" : "auto",
          }}
        >
          {[0, 1, 2, 3].map((slot) => {
            const text = samples[(chipOffset + slot) % samples.length];
            const isAbsorbing = absorbingChip === slot;
            return (
              <button
                key={slot}
                type="button"
                onMouseEnter={() => setHeadingHover(true)}
                onMouseLeave={() => setHeadingHover(false)}
                onClick={() => handleChipClick(slot, text)}
                style={{
                  ...chipStyle,
                  transform: isAbsorbing
                    ? "translateY(14px) scale(0.82)"
                    : headingHover
                      ? "translateY(-5px)"
                      : "translateY(0)",
                  opacity: isAbsorbing ? 0 : 1,
                  transitionDelay: headingHover && !isAbsorbing ? `${slot * 45}ms` : "0ms",
                }}
              >
                {text}
              </button>
            );
          })}
        </div>

        {/* Bottom: input centered */}
        <div
          ref={inputContainerRef}
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
              ref={inputRef}
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
              placeholder={currentMode.placeholder}
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
                opacity: dream.trim() ? 1 : 0.55,
                cursor: dream.trim() ? "pointer" : "default",
                transform:
                  btnHover && dream.trim()
                    ? "translateY(-1px)"
                    : "translateY(0)",
              }}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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

      {/* ── Section 2 — Journey: text TOP-LEFT, atmosphere BOTTOM-RIGHT ── */}
      <section ref={journeyRef} style={journeySectionStyle}>
        {/* Soft radial fog — frosts the mesh locally so orb pearls read cleanly */}
        <div ref={orbFogRef} style={orbFogStyle} />
        <div ref={journeyTextRef} style={journeyTextWrapStyle}>
          <span style={sectionEyebrowStyle}>II — Journey</span>
          <h2 style={sectionHeadingStyle}>
            Ancient symbols,<br/>modern mind.
          </h2>
          <p style={sectionSubStyle}>
            Your dream mapped against archetypes from Jung, Freud, and
            10,000 dreamers. Symbols surface. Patterns connect.
          </p>
        </div>
        <div ref={journeyAtmoRef} style={atmosphereWrapStyle}>
          <div style={atmosphereContainerStyle}>
            {/* Original colored orbs */}
            <div style={coreNodeStyle}>
              <div style={coreGlowStyle} />
              <div style={coreInnerStyle} />
              <span style={{ position: "relative", zIndex: 1 }}>Water</span>
            </div>
            {ATMO_ORBS.map((orb, i) => (
              <div key={orb.label} style={{
                ...smallNodeBase, top: orb.top, left: orb.left,
                animation: `floatNode ${6.8 + i * 0.4}s ease-in-out infinite ${i % 2 === 0 ? "normal" : "reverse"}`,
              }}>
                <div style={{ ...orbGlowStyle, background: `radial-gradient(circle, ${orb.glow} 0%, ${orb.glowMid} 26%, ${orb.glowFade} 48%, transparent 76%)` }} />
                <div style={{ ...orbInnerStyle, background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.18) 16%, ${orb.core} 34%, ${orb.coreFade} 60%, transparent 82%)` }} />
                <span style={orbLabelStyle}>{orb.label}</span>
              </div>
            ))}
            <div style={{ ...mistStyle, top: "22%", left: "10%", width: 124, height: 86, background: "rgba(190, 180, 210, 0.3)", animation: "drift 11s ease-in-out infinite alternate" }} />
            <div style={{ ...mistStyle, top: "24%", right: "12%", width: 126, height: 98, background: "rgba(175, 195, 215, 0.25)", animation: "drift 13s ease-in-out infinite alternate-reverse" }} />
            <div style={{ ...mistStyle, bottom: "18%", left: "32%", width: 172, height: 112, background: "rgba(210, 190, 200, 0.2)", animation: "drift 14s ease-in-out infinite alternate" }} />
            <div style={{ ...sparkStyle, top: "26%", left: "48%", width: 12, height: 12, animation: "twinkle 4.2s ease-in-out infinite" }} />
            <div style={{ ...sparkStyle, top: "72%", left: "18%", width: 8, height: 8, animation: "twinkle 5.2s ease-in-out infinite reverse" }} />
            <div style={{ ...sparkStyle, top: "35%", right: "18%", width: 11, height: 11, animation: "twinkle 4.8s ease-in-out infinite" }} />

            {/* Constellation variant — commented out for now
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={constellationSvgStyle}>
              <g stroke="rgba(70, 62, 104, 0.22)" strokeWidth="0.18" fill="none" strokeLinecap="round">
                {ATMO_NODES.map((n) => (
                  <line key={n.label} x1={ATMO_CENTER.x} y1={ATMO_CENTER.y} x2={n.x} y2={n.y} />
                ))}
              </g>
            </svg>
            <div style={{ ...constellationPointStyle, top: `${ATMO_CENTER.y}%`, left: `${ATMO_CENTER.x}%`, zIndex: 3 }}>
              <span style={centerStarStyle} />
              <span style={centerLabelStyle}>Water</span>
            </div>
            {ATMO_NODES.map((node, i) => (
              <div key={node.label} style={{ ...constellationPointStyle, top: `${node.y}%`, left: `${node.x}%` }}>
                <span style={{ ...satelliteStarStyle, animation: `twinkle ${4.4 + i * 0.35}s ease-in-out ${i * 0.4}s infinite alternate` }} />
                <span style={satelliteLabelStyle}>{node.label}</span>
              </div>
            ))}
            */}
          </div>
        </div>
      </section>

      {/* ── Section 3 — Awaken: text TOP-RIGHT, heatmap BOTTOM-LEFT ── */}
      <section ref={awakenRef} style={awakenSectionStyle}>
        <div ref={awakenTextRef} style={awakenTextWrapStyle}>
          <span style={sectionEyebrowStyle}>III — Awaken</span>
          <h2 style={sectionHeadingStyle}>
            Your rhythm,<br/>revealed.
          </h2>
          <p style={{ ...sectionSubStyle, marginLeft: "auto" }}>
            Dreams leave traces. See when they cluster, when they return,
            and what the frequency means.
          </p>
        </div>
        <div ref={awakenHeatRef} style={heatmapWrapStyle}>
          <div style={heatmapContainerStyle}>
            <div style={heatmapHeaderStyle}>
              <span style={heatmapLabelStyle}>Dream frequency</span>
              <span style={heatmapSubLabelStyle}>last 5 weeks</span>
            </div>
            <div style={heatmapBodyStyle}>
              <div style={heatmapWeekdayRowStyle}>
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} style={heatmapAxisLabelStyle}>{d}</span>
                ))}
              </div>
              <div style={heatmapBodyInnerStyle}>
                <div style={heatmapWeekColStyle}>
                  {["W1", "W2", "W3", "W4", "W5"].map((w) => (
                    <span key={w} style={heatmapAxisLabelStyle}>{w}</span>
                  ))}
                </div>
                <div style={heatmapGridStyle}>
                  {HEATMAP_DATA.slice(0, 35).map((level, i) => (
                    <span key={i} style={{ ...heatCellStyle, background: HEAT_COLORS[level] }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={heatmapLegendStyle}>
              <span style={heatmapLegendTextStyle}>Dreams / day</span>
              <div style={heatmapLegendScaleStyle}>
                {HEAT_COLORS.map((c, i) => (
                  <div key={i} style={heatmapLegendItemStyle}>
                    <span style={{ ...heatCellSmallStyle, background: c }} />
                    <span style={heatmapLegendCountStyle}>{i === HEAT_COLORS.length - 1 ? `${i}+` : i}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4 — Community dreams ── */}
      <section ref={communityRef} style={communityWrapperStyle}>
        <div style={communityHeaderStyle}>
          <p style={sectionHeadingStyle}>Dreams from the collective</p>
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

        {/* Edge fades */}
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

const meshWrapperStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  zIndex: 0,
  opacity: 0,
  transition: "opacity 0.15s ease-out",
};

// ── Cloud model wrapper — fixed, GSAP drives opacity + CSS vars for lift/scale ──
// Outer transform composes centering with scroll-driven vars; inner div handles sway.
const cloudWrapperStyle: React.CSSProperties = {
  position: "fixed",
  left: "72%",
  top: "56%",
  transform:
    "translate(-50%, -50%) translateY(var(--cloud-scroll-y, 0vh)) scale(var(--cloud-scroll-scale, 1))",
  width: "min(33.6vw, 432px)",
  height: "min(33.6vw, 432px)",
  zIndex: 1,
  pointerEvents: "none",
  opacity: 0,
  willChange: "transform, opacity",
  overflow: "visible",
};

const cloudSwayStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  animation: "cloudSway 14s ease-in-out infinite",
  willChange: "transform",
  overflow: "visible",
};

// ── Hero section ──
const heroSectionStyle: React.CSSProperties = {
  position: "relative",
  height: "100vh",
  zIndex: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  paddingLeft: "13vw",
  paddingRight: "8vw",
  paddingTop: "10vh",
  paddingBottom: "6vh",
  gap: 44,
};

const heroContentStyle: React.CSSProperties = {
  textAlign: "left",
  maxWidth: "min(520px, 46vw)",
  minHeight: 180,
  zIndex: 15,
};

const heroHeadingStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "clamp(3.4rem, 5.2vw, 5.2rem)",
  fontWeight: 400,
  fontStyle: "italic",
  letterSpacing: "-0.025em",
  lineHeight: 1.04,
  margin: "0 0 20px 0",
  color: "#15102a",
  textShadow: "0 1px 24px rgba(255, 255, 255, 0.5)",
  cursor: "default",
};

const heroSubStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontStyle: "italic",
  fontSize: "1.18rem",
  fontWeight: 500,
  letterSpacing: "0.005em",
  color: "rgba(26, 20, 48, 0.82)",
  margin: 0,
  lineHeight: 1.45,
  textShadow: "0 1px 10px rgba(255, 255, 255, 0.55)",
};

// ── Prompt chips — bridge between heading and input ──
const chipRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-start",
  gap: 8,
  maxWidth: "min(520px, 46vw)",
  zIndex: 15,
  transition: "opacity 0.5s ease, transform 0.5s ease",
};

// ── Mode selector — teaches the 3 flows from graph.py ──
const modeTabsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  maxWidth: "min(520px, 46vw)",
  zIndex: 15,
  transition: "opacity 0.4s ease",
};

const modeTabStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  padding: "9px 16px 9px 14px",
  borderRadius: 999,
  border: "1px solid rgba(126, 135, 223, 0.18)",
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.84rem",
  fontWeight: 600,
  letterSpacing: "0.01em",
  cursor: "pointer",
  backdropFilter: "blur(12px) saturate(140%)",
  transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
};

const modeTabDotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  flexShrink: 0,
};

const chipStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid rgba(126, 135, 223, 0.3)",
  background: "rgba(24, 20, 38, 0.5)",
  backdropFilter: "blur(14px) saturate(140%)",
  color: "rgba(240, 236, 252, 0.98)",
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.86rem",
  fontWeight: 500,
  letterSpacing: "0.005em",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  boxShadow: "0 4px 14px rgba(24, 20, 38, 0.12)",
  transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease, background 0.3s ease, border-color 0.3s ease",
};

// ── Scattered dream pills ──
const scatteredPillStyle: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 14,
  border: "1px solid rgba(126, 135, 223, 0.12)",
  background: "rgba(30, 26, 42, 0.28)",
  backdropFilter: "blur(12px)",
  color: "rgba(200, 195, 220, 0.6)",
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.02em",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.3s ease",
};

// ── Input — bottom center of hero ──
const inputContainerStyle: React.CSSProperties = {
  width: "min(520px, 48vw)",
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
  background: "rgba(24, 20, 38, 0.62)",
  backdropFilter: "blur(24px) saturate(150%)",
  border: "1px solid rgba(126, 135, 223, 0.38)",
  transition: "box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s ease",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "14px 18px",
  borderRadius: 18,
  border: "none",
  background: "transparent",
  fontFamily: '"Manrope", sans-serif',
  fontSize: "1.02rem",
  fontWeight: 500,
  color: "rgba(240, 236, 252, 1)",
  outline: "none",
  letterSpacing: "0.005em",
};

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
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.78rem",
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "rgba(42, 34, 66, 0.72)",
  transition: "opacity 0.3s ease",
  textAlign: "left",
  paddingLeft: 6,
  textShadow: "0 1px 8px rgba(255, 255, 255, 0.5)",
};

// ── Section 2 — Journey: text TOP-LEFT, atmosphere BOTTOM-RIGHT ──
const journeySectionStyle: React.CSSProperties = {
  position: "relative",
  height: "100vh",
  zIndex: 10,
  overflow: "hidden",
};

const journeyTextWrapStyle: React.CSSProperties = {
  position: "absolute",
  top: "16vh",
  left: "14vw",
  maxWidth: "58vw",
  opacity: 0,
  zIndex: 3,
  textAlign: "left",
};

// ── Section 3 — Awaken: text TOP-RIGHT, heatmap BOTTOM-LEFT ──
const awakenSectionStyle: React.CSSProperties = {
  position: "relative",
  height: "100vh",
  zIndex: 10,
  overflow: "hidden",
};

const awakenTextWrapStyle: React.CSSProperties = {
  position: "absolute",
  top: "16vh",
  right: "7vw",
  maxWidth: "58vw",
  opacity: 0,
  zIndex: 3,
  textAlign: "right",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
};

// ── Soft glass fog (Section 2) — true backdrop-filter frost behind orb cluster ──
// Matches dashboard.html .glass: backdrop-filter: blur(24px) saturate(145%)
const orbFogStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "-18vh",
  right: "-18vw",
  width: "85vw",
  height: "115vh",
  background:
    "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.26) 30%, rgba(255,255,255,0.1) 58%, transparent 84%)",
  backdropFilter: "blur(26px) saturate(145%)",
  WebkitBackdropFilter: "blur(26px) saturate(145%)",
  maskImage:
    "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.88) 34%, rgba(0,0,0,0.52) 58%, rgba(0,0,0,0.2) 74%, transparent 90%)",
  WebkitMaskImage:
    "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.88) 34%, rgba(0,0,0,0.52) 58%, rgba(0,0,0,0.2) 74%, transparent 90%)",
  pointerEvents: "none",
  zIndex: 1,
  opacity: 0,
  willChange: "opacity",
};

// ── Dream Atmosphere (Section 2, bottom-right) ──
const atmosphereWrapStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "4vh",
  right: "2vw",
  opacity: 0,
  zIndex: 2,
};

const atmosphereContainerStyle: React.CSSProperties = {
  position: "relative",
  width: "min(480px, 42vw)",
  height: "min(480px, 42vw)",
};

// ── Original orb styles (restored) ──
const coreNodeStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 2,
  top: "52%",
  left: "50%",
  width: 176,
  height: 176,
  transform: "translate(-50%, -50%)",
  display: "grid",
  placeItems: "center",
  borderRadius: 999,
  fontFamily: '"Cormorant Garamond", serif',
  color: "rgba(64, 56, 82, 0.7)",
  fontSize: "2.6rem",
  textShadow: "0 0 18px rgba(255, 255, 255, 0.4), 0 2px 14px rgba(160, 155, 180, 0.12)",
  isolation: "isolate",
  animation: "pulseDrift 8s ease-in-out infinite alternate",
};

const coreGlowStyle: React.CSSProperties = {
  position: "absolute",
  inset: -44,
  borderRadius: "inherit",
  background: "radial-gradient(circle, rgba(160, 155, 200, 0.7) 0%, rgba(170, 165, 205, 0.5) 22%, rgba(185, 180, 210, 0.28) 46%, rgba(195, 190, 215, 0.1) 62%, transparent 78%)",
  filter: "blur(32px)",
  zIndex: -2,
};

const coreInnerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 4,
  borderRadius: "inherit",
  background: "radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.28) 14%, rgba(185, 180, 215, 0.5) 34%, rgba(175, 170, 205, 0.2) 58%, transparent 78%)",
  filter: "blur(10px)",
  zIndex: -1,
};

const smallNodeBase: React.CSSProperties = {
  position: "absolute",
  zIndex: 2,
  width: 88,
  height: 88,
  display: "grid",
  placeItems: "center",
  borderRadius: 999,
  isolation: "isolate",
};

const orbGlowStyle: React.CSSProperties = {
  position: "absolute",
  inset: -20,
  borderRadius: "inherit",
  filter: "blur(20px)",
  zIndex: -2,
};

const orbInnerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 6,
  borderRadius: "inherit",
  filter: "blur(11px)",
  zIndex: -1,
};

const orbLabelStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "block",
  maxWidth: 68,
  textAlign: "center",
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "1.02rem",
  fontStyle: "italic",
  lineHeight: 1.15,
  fontWeight: 500,
  letterSpacing: "0.005em",
  color: "rgba(32, 26, 54, 0.92)",
  textShadow:
    "0 0 1px rgba(255, 255, 255, 0.9), 0 1px 2px rgba(255, 255, 255, 0.75), 0 0 18px rgba(255, 255, 255, 0.55), 0 1px 3px rgba(42, 35, 64, 0.12)",
};

const mistStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 1,
  borderRadius: 999,
  filter: "blur(30px)",
  opacity: 1,
  pointerEvents: "none",
};

const sparkStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 1,
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.6)",
  boxShadow: "0 0 16px rgba(255, 255, 255, 0.4), 0 0 32px rgba(200, 195, 215, 0.15)",
  opacity: 1,
  pointerEvents: "none",
};

// ── Constellation styles (kept for reference) ──
const constellationSvgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 1,
  pointerEvents: "none",
  overflow: "visible",
};

// Shared wrapper for center + satellite points — positioned by top/left %
const constellationPointStyle: React.CSSProperties = {
  position: "absolute",
  transform: "translate(-50%, -50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  zIndex: 2,
  pointerEvents: "none",
};

// Center "Water" glowing dot
const centerStarStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  background: "radial-gradient(circle, rgba(255, 255, 255, 0.98) 0%, rgba(222, 218, 238, 0.85) 40%, rgba(190, 186, 220, 0.25) 80%, transparent)",
  boxShadow: "0 0 22px rgba(200, 194, 230, 0.65), 0 0 48px rgba(200, 194, 230, 0.25)",
  animation: "corePulse 5.5s ease-in-out infinite",
};

const centerLabelStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontStyle: "italic",
  fontSize: "2.1rem",
  fontWeight: 400,
  letterSpacing: "-0.01em",
  color: "rgba(42, 35, 64, 0.82)",
  textShadow: "0 2px 18px rgba(255, 255, 255, 0.6), 0 1px 2px rgba(42, 35, 64, 0.08)",
  whiteSpace: "nowrap",
};

// Satellite star + label
const satelliteStarStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(220, 216, 236, 0.6) 50%, transparent 85%)",
  boxShadow: "0 0 12px rgba(200, 194, 228, 0.7), 0 0 24px rgba(200, 194, 228, 0.28)",
};

const satelliteLabelStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontStyle: "italic",
  fontSize: "0.98rem",
  fontWeight: 400,
  letterSpacing: "-0.005em",
  color: "rgba(52, 45, 71, 0.7)",
  textShadow: "0 1px 10px rgba(255, 255, 255, 0.55)",
  whiteSpace: "nowrap",
};

// ── Heatmap (Section 3, bottom-left) ──
const heatmapWrapStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "6vh",
  left: "12vw",
  opacity: 0,
  zIndex: 2,
};

const heatmapContainerStyle: React.CSSProperties = {
  width: "min(520px, 44vw)",
  padding: 34,
  borderRadius: 34,
  background: `
    radial-gradient(circle at 82% 18%, rgba(204, 228, 255, 0.1), transparent 32%),
    radial-gradient(circle at 18% 82%, rgba(246, 213, 222, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04))
  `,
  border: "1px solid rgba(255, 255, 255, 0.22)",
  boxShadow: "0 20px 60px rgba(96, 82, 124, 0.06)",
  backdropFilter: "blur(18px) saturate(130%)",
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const heatmapHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
};

const heatmapLabelStyle: React.CSSProperties = {
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "rgba(42, 34, 66, 0.78)",
};

const heatmapSubLabelStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontStyle: "italic",
  fontSize: "1.05rem",
  fontWeight: 500,
  color: "rgba(42, 34, 66, 0.7)",
};

const heatmapBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const heatmapWeekdayRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px repeat(7, 1fr)",
  gap: 8,
  paddingLeft: 0,
};

const heatmapBodyInnerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px 1fr",
  gap: 8,
  alignItems: "stretch",
};

const heatmapWeekColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateRows: "repeat(5, 1fr)",
  gap: 8,
  alignItems: "center",
};

const heatmapAxisLabelStyle: React.CSSProperties = {
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.74rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  color: "rgba(42, 34, 66, 0.6)",
  textAlign: "center",
  textTransform: "uppercase" as const,
};

const heatmapGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gridTemplateRows: "repeat(5, 1fr)",
  gap: 8,
};

const heatCellStyle: React.CSSProperties = {
  aspectRatio: "1",
  borderRadius: 10,
  border: "1px solid rgba(255, 255, 255, 0.45)",
};

const heatmapLegendStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginTop: 6,
  paddingTop: 12,
  borderTop: "1px solid rgba(255, 255, 255, 0.3)",
};

const heatmapLegendTextStyle: React.CSSProperties = {
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  color: "rgba(42, 34, 66, 0.72)",
  textTransform: "uppercase" as const,
};

const heatmapLegendScaleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const heatmapLegendItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
};

const heatmapLegendCountStyle: React.CSSProperties = {
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.74rem",
  fontWeight: 700,
  color: "rgba(42, 34, 66, 0.7)",
  letterSpacing: "0.02em",
};

const heatCellSmallStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 5,
  border: "1px solid rgba(255, 255, 255, 0.45)",
};

const sectionEyebrowStyle: React.CSSProperties = {
  display: "block",
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase" as const,
  color: "rgba(42, 34, 66, 0.72)",
  marginBottom: 26,
  textShadow: "0 1px 10px rgba(255, 255, 255, 0.5)",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "clamp(3.2rem, 6vw, 5.6rem)",
  fontWeight: 400,
  fontStyle: "italic",
  letterSpacing: "-0.028em",
  lineHeight: 1,
  margin: "0 0 30px 0",
  color: "#1e1636",
  textShadow: "0 1px 22px rgba(255, 255, 255, 0.5)",
};

const sectionSubStyle: React.CSSProperties = {
  fontFamily: '"Manrope", sans-serif',
  fontSize: "1.18rem",
  fontWeight: 500,
  color: "rgba(36, 28, 58, 0.85)",
  lineHeight: 1.6,
  margin: 0,
  maxWidth: 480,
  letterSpacing: "0.003em",
};

// ── Section 4: community dreams ──
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
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.74rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  padding: "5px 11px",
  borderRadius: 8,
  background: "rgba(126, 135, 223, 0.18)",
  border: "1px solid rgba(126, 135, 223, 0.22)",
  color: "rgba(220, 216, 245, 1)",
};

const cardTextStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "1.24rem",
  fontWeight: 500,
  fontStyle: "italic",
  lineHeight: 1.45,
  color: "rgba(242, 238, 252, 1)",
  margin: 0,
  flex: 1,
};

const cardDreamerStyle: React.CSSProperties = {
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.8rem",
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "rgba(212, 208, 235, 0.88)",
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
  fontFamily: '"Manrope", sans-serif',
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase" as const,
  color: "#2a2340",
  transition: "all 0.25s ease",
  whiteSpace: "nowrap" as const,
};

const rightDotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  flexShrink: 0,
};
