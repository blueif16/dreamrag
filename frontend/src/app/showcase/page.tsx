"use client";

import { NavShell } from "@/components/NavShell";
import { widgetEntries } from "@/lib/widgetEntries";

// ---------------------------------------------------------------------------
// Mock data per widget id — realistic "teeth falling out" / "water" dream
// shaped against each widget.config.ts parameter schema.
// ---------------------------------------------------------------------------

const MOCKS: Record<string, Record<string, unknown>> = {
  current_dream: {
    title: "Teeth crumbling in the mirror",
    quote:
      "I was standing in a bathroom and watching my teeth loosen one by one. I spit them into my hand — they were still warm. No one else seemed alarmed.",
    meaning:
      "In dream literature, teeth are a nexus of identity, potency and control. Their sudden loosening often signals a passage — a threshold where the dreamer feels the ground of self shifting without consent. The mirror reinforces this: you are watching yourself become unfamiliar.",
    subconscious_emotion:
      "A quiet apprehension sits underneath the scene. The calm of the bystanders points to isolation — the fear belongs to the dreamer alone.",
    life_echo:
      "Community reports frequently pair this imagery with life transitions: job changes, breakups, or the long end of adolescence. The tooth-in-hand detail is unusually common.",
    source_chunk_ids: [74966, 68593, 71527],
  },

  interpretation_synthesis: {
    symbol: "Teeth",
    subtitle:
      "The unraveling of power, transformation, and the bittersweet pleasure-pain of release",
    paragraphs: [
      {
        text: "Dreams of teeth falling out carry a complex emotional signature — many dreamers report a paradoxical mix of alarm and pleasure as the teeth loosen. The sensation of wiggling a loose tooth, reminiscent of childhood, can evoke both apprehension about loss and a strange satisfaction in the act of release itself.",
        source: "community",
      },
      {
        text: "Freud observed that dreams of dental irritation and tooth extraction often connect to puberty and sexual development. In one documented dream, a colleague reported teeth coming out 'so easily only before puberty', with the decisive moment for women being 'the birth of a child'.",
        source: "textbook",
      },
      {
        text: "In your own dream journal, teeth have surfaced three times this month — each time paired with a mirror and a private bathroom. The recurring enclosure suggests the image belongs to a solitary, interior conversation about change.",
        source: "personal",
      },
    ],
    source_chunk_ids: [74966, 68593, 71527, 71400, 71312],
  },

  textbook_card: {
    symbol: "Teeth",
    excerpt:
      "I then noticed (as I believe half awake) that this dream was accompanied by a pollution which I cannot however definitely place at a particular point in the dream; I am inclined to think that it began with the pulling out of the tooth.",
    author: "Sigmund Freud",
    source: "The Interpretation of Dreams",
    source_chunk_ids: [74966],
  },

  community_mirror: {
    symbol: "teeth falling out",
    snippets: [
      {
        text: "I dreamed my tooth was loose and I hit it on something and I tried to pull it out. All my front teeth except two fell out.",
        emotions: ["anxiety", "fear"],
        similarity: 0.777,
      },
      {
        text: "Suddenly I heard a crunching noise and felt something drop into my mouth. I spit it into my hand and saw it was a tooth. I remarked upon the oddity only to feel a sudden avalanche of falling teeth.",
        emotions: ["wonder", "urgency"],
        similarity: 0.76,
      },
      {
        text: "One of my teeth hurt me. I wiggled it and found that it was loose. It was rather painful, but there was a definite element of pleasure involved so I kept wriggling until the tooth came out.",
        emotions: ["calm", "joy"],
        similarity: 0.728,
      },
      {
        text: "My mouth felt sore and swollen and I spit out what was in it. My hand was full of blood and teeth.",
        emotions: ["fear", "sadness"],
        similarity: 0.725,
      },
    ],
    source_chunk_ids: [68593, 71527, 71400, 71312],
  },

  emotion_split: {
    symbol: "Teeth",
    symbol_emotions: [
      { label: "Apprehension", value: 45 },
      { label: "Fear", value: 25 },
      { label: "Pain", value: 15 },
      { label: "Pleasure", value: 10 },
      { label: "Relief", value: 5 },
    ],
    overall_emotions: [
      { label: "Apprehension", value: 30 },
      { label: "Happiness", value: 20 },
      { label: "Confusion", value: 18 },
      { label: "Fear", value: 15 },
      { label: "Surprise", value: 17 },
    ],
  },

  symbol_cooccurrence_network: {
    center_symbol: "Teeth",
    nodes: [
      { label: "Mirror", weight: 0.92 },
      { label: "Blood", weight: 0.78 },
      { label: "Mouth", weight: 0.71 },
      { label: "Falling", weight: 0.63 },
      { label: "Childhood", weight: 0.55 },
      { label: "Bathroom", weight: 0.48 },
    ],
  },

  dream_atmosphere: {
    center_symbol: "Teeth",
    satellites: ["Mirror", "Bathroom", "Falling", "Night", "Mouth"],
    source_chunk_ids: [74966, 68593],
  },

  echoes_card: {
    echoes: [
      {
        date: "2026-03-12",
        title: "Crumbling classroom",
        text: "A wall of teeth behind the blackboard, slowly falling into rows. No one turned around.",
      },
      {
        date: "2026-02-28",
        title: "Cold basin",
        text: "I cupped water in my hands; a single molar floated up from the bottom of the sink.",
      },
      {
        date: "2026-01-19",
        title: "Night drive",
        text: "Driving alone, chewing something that turned out to be my own teeth. The road kept widening.",
      },
    ],
    source_chunk_ids: [11021, 11098, 11144],
  },

  followup_chat: {
    dream_title: "Teeth Falling Out",
    prompts: [
      "What does Freud mean when he connects teeth dreams to puberty and sexual development?",
      "Why do so many people report pleasure mixed with fear when their teeth fall out in dreams?",
      "Is there a difference between dreaming of one tooth falling out versus all teeth at once?",
      "What does the blood in teeth dreams symbolize across interpretation traditions?",
    ],
    source_chunk_ids: [74966, 68593, 71527, 71400, 71312, 71418],
  },

  heatmap_calendar: {
    month: "April",
    data: [
      [1, 2, 0, 3, 4],
      [0, 1, 2, 2, 3],
      [2, 0, 1, 4, 2],
      [3, 2, 0, 1, 4],
      [0, 1, 2, 3, 2],
      [1, 0, 3, 2, 0],
      [2, 1, 0, 0, 1],
    ],
  },

  dream_streak: {
    streak: 27,
    last7: [true, true, false, true, true, true, true],
  },

  top_symbol: {
    symbol: "Teeth",
    count: 9,
    window: "last 30 dreams",
    cooccurrences: [
      { label: "Mirror", count: 6 },
      { label: "Blood", count: 4 },
      { label: "Falling", count: 3 },
      { label: "Mouth", count: 3 },
    ],
  },

  stat_card: {
    label: "Teeth Frequency",
    personal: 31,
    baseline: 12,
    description: "of your dreams feature teeth imagery",
  },

  recurrence_card: {},
  emotional_climate: {},

  text_response: {
    message:
      "Teeth in dreams sit at the border between biology and identity. Across the chunks you've surfaced, the image most often arrives during thresholds — moments when the dreamer is quietly reorganizing their sense of self.",
    source_chunk_ids: [74966, 68593],
  },
};

// ---------------------------------------------------------------------------
// Width → pixel frame so each widget renders at its intended layout size.
// Mirrors layoutClasses() in WidgetPanel.tsx — 6-col grid assumption.
// ---------------------------------------------------------------------------

function frameSize(layout?: { width?: string; height?: string }) {
  const w = layout?.width ?? "half";
  const h = layout?.height ?? "compact";
  const width =
    w === "full" ? 1200 : w === "half" ? 580 : 380;
  const minHeight =
    h === "fill" ? 640
      : h === "tall" ? 420
      : h === "medium" ? 280
      : 160;
  return { width, minHeight };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShowcasePage() {
  const sorted = [...widgetEntries].sort((a, b) =>
    a.config.id.localeCompare(b.config.id),
  );

  return (
    <div style={shellBg}>
      <div style={glowTop} />
      <div style={glowBottom} />

      <NavShell />

      <section style={pageLabelStyle}>
        <small style={pageLabelSmallStyle}>Showcase</small>
        <h1 style={pageLabelH1Style}>Widget catalog with mock data.</h1>
        <p style={pageLabelSubStyle}>
          Every registered widget rendered at its native layout size so you can
          review each one in isolation.
        </p>
      </section>

      <main style={listWrapStyle}>
        {sorted.map((entry) => {
          const mock = MOCKS[entry.config.id] ?? {};
          const { width, minHeight } = frameSize(entry.config.layout);
          const Component = entry.Component;

          return (
            <article key={entry.config.id} style={rowStyle}>
              <header style={rowHeaderStyle}>
                <div>
                  <div style={rowIdStyle}>{entry.config.id}</div>
                  <div style={rowToolStyle}>{entry.config.tool.name}</div>
                </div>
                <div style={rowMetaStyle}>
                  <span style={chipStyle}>
                    {entry.config.layout?.width ?? "half"} ·{" "}
                    {entry.config.layout?.height ?? "compact"}
                  </span>
                  <span style={chipStyle}>
                    {entry.config.agent ? `smart · ${entry.config.agent}` : "dumb"}
                  </span>
                </div>
              </header>

              <div style={{ ...frameStyle, width, minHeight }}>
                <Component {...mock} widgetId={entry.config.id} />
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles — match dashboard theme
// ---------------------------------------------------------------------------

const shellBg: React.CSSProperties = {
  position: "relative",
  minHeight: "100dvh",
  fontFamily: '"Manrope", sans-serif',
  color: "#403852",
  background: `
    radial-gradient(circle at 12% 18%, rgba(214, 241, 231, 0.9), transparent 24%),
    radial-gradient(circle at 84% 10%, rgba(227, 220, 255, 0.92), transparent 30%),
    radial-gradient(circle at 82% 82%, rgba(250, 223, 232, 0.82), transparent 24%),
    radial-gradient(circle at 28% 74%, rgba(203, 224, 255, 0.7), transparent 22%),
    linear-gradient(160deg, #f8f4ee 0%, #f2edf7 46%, #fbf7f0 100%)
  `,
  overflowX: "hidden",
  paddingBottom: 120,
};

const glowTop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  background: `
    radial-gradient(circle at 50% 0%, rgba(255,255,255,0.5), transparent 36%),
    linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.02))
  `,
};

const glowBottom: React.CSSProperties = {
  position: "fixed",
  right: "-8vw",
  bottom: "-12vw",
  width: "42vw",
  height: "42vw",
  zIndex: 0,
  pointerEvents: "none",
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(255,255,255,0.18), rgba(216,207,255,0.06) 54%, transparent 72%)",
  filter: "blur(22px)",
};

const pageLabelStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 1500,
  width: "min(calc(100% - 34px), 1500px)",
  margin: "30px auto 24px",
  paddingLeft: 80,
  paddingRight: 24,
};

const pageLabelSmallStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 10,
  fontSize: "0.74rem",
  fontWeight: 800,
  color: "#89829c",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
};

const pageLabelH1Style: React.CSSProperties = {
  margin: 0,
  fontFamily: '"Cormorant Garamond", serif',
  fontWeight: 600,
  fontSize: "clamp(2.4rem, 3.4vw, 4rem)",
  lineHeight: 0.98,
  letterSpacing: "-0.02em",
  color: "#403852",
};

const pageLabelSubStyle: React.CSSProperties = {
  marginTop: 14,
  maxWidth: 640,
  fontSize: "0.92rem",
  lineHeight: 1.55,
  color: "rgba(64, 56, 82, 0.68)",
};

const listWrapStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 1500,
  width: "min(calc(100% - 34px), 1500px)",
  margin: "0 auto",
  paddingLeft: 80,
  paddingRight: 24,
  display: "flex",
  flexDirection: "column",
  gap: 44,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  paddingTop: 28,
  borderTop: "1px solid rgba(107,95,165,0.1)",
};

const rowHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
};

const rowIdStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: "1.7rem",
  fontWeight: 600,
  color: "#2d2640",
  letterSpacing: "-0.01em",
};

const rowToolStyle: React.CSSProperties = {
  marginTop: 4,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 12,
  color: "#8a7fa0",
};

const rowMetaStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const chipStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#5B6EAF",
  background: "rgba(91,110,175,0.08)",
  border: "1px solid rgba(91,110,175,0.15)",
  borderRadius: 99,
  padding: "4px 11px",
};

const frameStyle: React.CSSProperties = {
  position: "relative",
  maxWidth: "100%",
};
