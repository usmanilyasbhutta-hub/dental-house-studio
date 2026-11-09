import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useVideoConfig } from "remotion";
import { video } from "../brand";
import { headline, mono, serif } from "../templates/shared/text";
import { Backdrop } from "../templates/shared/Backdrop";
import { ThemeContext, themes, useTheme } from "../theme";
import { FxContext, TRANSITIONS, type TransitionName } from "./context";
import { Scenes } from "./Scenes";
import {
  Confetti,
  CountUp,
  DrawArrow,
  DrawCircle,
  DrawUnderline,
  Glitch,
  Glow,
  Highlighter,
  LightLeak,
  LightSweep,
  PunchZoom,
  Shake,
  ShineText,
  Sfx,
  Sparkles,
  Typewriter,
} from "./effects";

const SEG = 75; // 2.5 s per effect

/** Every effect, labelled. Render: npx remotion render src/index.ts EffectsGallery out/effects-gallery.mp4 */
const DEMOS: { name: string; when: string; sfx?: Parameters<typeof Sfx>[0]["name"]; node: React.ReactNode }[] = [
  {
    name: "ShineText",
    when: "price, offer, key number",
    sfx: "shimmer",
    node: (
      <Big>
        <ShineText delay={10}>FREE</ShineText>
      </Big>
    ),
  },
  {
    name: "Highlighter",
    when: "one key word in education",
    node: (
      <Mid>
        Brush <Highlighter delay={10}>twice</Highlighter> a day
      </Mid>
    ),
  },
  {
    name: "Typewriter",
    when: "question hooks, myths",
    sfx: "tick",
    node: (
      <Mid>
        <Typewriter text="Does it hurt?" delay={6} />
      </Mid>
    ),
  },
  {
    name: "CountUp",
    when: "statistics, prices, counts",
    sfx: "tick",
    node: (
      <Big>
        <CountUp to={10} delay={6} duration={34} prefix="1 in " />
      </Big>
    ),
  },
  {
    name: "Glow",
    when: "calm emphasis on a word",
    node: (
      <Big>
        <Glow>Gentle</Glow>
      </Big>
    ),
  },
  {
    name: "Sparkles",
    when: "fresh / clean / done (never on clinical photos)",
    sfx: "shimmer",
    node: (
      <>
        <Big>Fresh</Big>
        <Sparkles x={50} y={48} spread={50} count={12} />
      </>
    ),
  },
  {
    name: "LightSweep",
    when: "logo, CTA pill, product shot",
    node: (
      <LogoBox>
        <LightSweep delay={12} />
      </LogoBox>
    ),
  },
  {
    name: "LightLeak",
    when: "warm mood over footage / backdrop",
    node: (
      <>
        <Mid>Your smile has a home.</Mid>
        <LightLeak opacity={0.5} />
      </>
    ),
  },
  {
    name: "DrawCircle",
    when: "point at a tooth / area",
    node: (
      <>
        <Mid>Look here</Mid>
        <DrawCircle x={540} y={1000} r={170} delay={8} />
      </>
    ),
  },
  {
    name: "DrawArrow",
    when: "annotate photos, diagrams",
    node: (
      <>
        <Mid>Gumline</Mid>
        <DrawArrow x1={280} y1={1250} x2={700} y2={1010} delay={8} />
      </>
    ),
  },
  {
    name: "DrawUnderline",
    when: "under a headline",
    node: (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={headline(120)}>Consult first</div>
        <DrawUnderline width={620} delay={8} />
      </AbsoluteFill>
    ),
  },
  {
    name: "PunchZoom",
    when: "landing a key point",
    sfx: "thud",
    node: (
      <PunchZoom at={12}>
        <Big>Now.</Big>
      </PunchZoom>
    ),
  },
  {
    name: "Shake",
    when: "contemporary offers only",
    sfx: "thud",
    node: (
      <Shake at={12}>
        <Big>50% OFF</Big>
      </Shake>
    ),
  },
  {
    name: "Glitch",
    when: "contemporary offers only, never education",
    node: (
      <Glitch at={14} frames={8}>
        <Big>NEW</Big>
      </Glitch>
    ),
  },
  {
    name: "Confetti",
    when: "celebrations, milestones",
    sfx: "pop",
    node: (
      <>
        <Big>Shabash!</Big>
        <Confetti />
      </>
    ),
  },
];

export const EffectsGallery: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <ThemeContext.Provider value={themes.brand}>
      <FxContext.Provider value={{ transition: "none", transitionFrames: 10, sfx: "subtle" }}>
        <AbsoluteFill style={{ color: themes.brand.text }}>
          <Backdrop />
          {DEMOS.map((d, i) => (
            <Sequence key={d.name} from={i * SEG} durationInFrames={SEG}>
              {d.node}
              {d.sfx ? <Sfx name={d.sfx} at={12} volume={0.5} /> : null}
              <Label name={d.name} when={d.when} />
            </Sequence>
          ))}
          <Sequence from={DEMOS.length * SEG} durationInFrames={TRANSITION_DEMOS.length * TR_SEG}>
            <TransitionsReel fps={fps} />
          </Sequence>
        </AbsoluteFill>
      </FxContext.Provider>
    </ThemeContext.Provider>
  );
};

const TRANSITION_DEMOS = TRANSITIONS.filter((t) => t !== "none");
const TR_SEG = 54; // 24 + 36 frames minus the 12-frame overlap = 48, plus a short hold
export const galleryFrames = DEMOS.length * SEG + TRANSITION_DEMOS.length * TR_SEG;

/** Each transition between two cards (cards 40 frames + 12-frame transitions). */
const TransitionsReel: React.FC<{ fps: number }> = () => (
  <>
    {TRANSITION_DEMOS.map((name, i) => (
      <Sequence key={name} from={i * TR_SEG} durationInFrames={TR_SEG}>
        <FxContext.Provider value={{ transition: name as TransitionName, transitionFrames: 12, sfx: "none" }}>
          <Scenes
            items={[
              { seconds: 0.8, node: <Card n={1} name={name} /> },
              { seconds: 1.2, node: <Card n={2} name={name} /> },
            ]}
          />
        </FxContext.Provider>
      </Sequence>
    ))}
  </>
);

const Card: React.FC<{ n: number; name: string }> = ({ n, name }) => {
  const t = useTheme();
  return (
    <AbsoluteFill
      style={{
        background: n === 1 ? t.bgBottom : t.end.top,
        alignItems: "center",
        justifyContent: "center",
        color: n === 1 ? t.text : t.end.text,
      }}
    >
      <div style={mono(30, n === 1 ? t.accent : t.end.accent)}>Transition</div>
      <div style={headline(130)}>{name}</div>
    </AbsoluteFill>
  );
};

function Big({ children }: { children: React.ReactNode }) {
  return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...headline(220) }}>{children}</AbsoluteFill>;
}
function Mid({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...headline(110), textAlign: "center", padding: 80 }}>
      {children}
    </AbsoluteFill>
  );
}
function LogoBox({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "50px 60px", background: themes.brand.end.top }}>
        <Img src={staticFile("brand/logo.png")} style={{ width: 640, display: "block" }} />
        {children}
      </div>
    </AbsoluteFill>
  );
}
const Label: React.FC<{ name: string; when: string }> = ({ name, when }) => {
  const t = useTheme();
  return (
    <div style={{ position: "absolute", left: 90, right: video.safe.right, top: 300 }}>
      <div style={mono(30, t.accent)}>Effect</div>
      <div style={{ ...headline(72), marginTop: 8 }}>{name}</div>
      <div style={{ ...serif(46, t.muted), marginTop: 10 }}>{when}</div>
    </div>
  );
};
