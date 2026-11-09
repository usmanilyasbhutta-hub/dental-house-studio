import React from "react";
import { useTheme } from "../theme";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { video } from "../brand";
import type { OfferBrief } from "../brief/schema";
import { scenes, sec } from "../brief/timing";
import { KineticHeadline } from "./shared/Headline";
import { prog, sceneFade } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { Scenes, useEdgeFade } from "../fx/Scenes";
import { ShineText, Sfx, Sparkles } from "../fx/effects";
import { Step } from "./shared/Step";
import { fitSize, headline, mono, serif } from "./shared/text";

const s = scenes.offer;

export const Offer: React.FC<{ brief: OfferBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  return (
    <Shell brief={brief} endSeconds={s.end} showSafeZones={showSafeZones}>
      <Scenes
        items={[
          {
            seconds: s.hook,
            node: (
              <>
                <Center dur={sec(s.hook, fps)}>
                  <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} />
                </Center>
              </>
            ),
          },
          {
            seconds: s.reveal,
            node: (
              <>
                <Reveal brief={brief} dur={sec(s.reveal, fps)} />
              </>
            ),
          },
          ...brief.points.map((p, i) => ({
            seconds: s.point,
            node: (
              <>
                <Step n={i + 1} title={p} dur={sec(s.point, fps)} />
              </>
            ),
          })),
          {
            seconds: s.terms,
            node: (
              <>
                <Terms brief={brief} dur={sec(s.terms, fps)} />
              </>
            ),
          },
        ]}
      />
    </Shell>
  );
};

const Center: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const edge = useEdgeFade();
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", paddingLeft: 90, paddingRight: video.safe.right, opacity: sceneFade(frame, dur, 8, edge) }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Reveal: React.FC<{ brief: OfferBrief; dur: number }> = ({ brief, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.5);
  const b = prog(frame, fps * 0.35, fps * 0.6);
  const c = prog(frame, fps * 0.7, fps * 0.6);
  return (
    <Center dur={dur}>
      <Sfx name="whoosh" at={0} volume={0.45} />
      <Sfx name="shimmer" at={Math.round(fps * 0.45)} volume={0.35} />
      <div style={{ ...mono(30, t.accent), opacity: a }}>Limited offer</div>
      <div
        style={{
          ...headline(fitSize([brief.offer.headline], 850, 140)),
          marginTop: 26,
          opacity: a,
          transform: `translateY(${(1 - a) * 40}px)`,
        }}
      >
        {brief.offer.headline}
      </div>
      {brief.offer.price ? (
        <div
          style={{
            position: "relative",
            ...headline(fitSize([brief.offer.price], 850, 170), t.accent),
            marginTop: 18,
            opacity: b,
            transform: `scale(${0.9 + 0.1 * b})`,
            transformOrigin: "left",
          }}
        >
          <ShineText delay={Math.round(fps * 0.8)} duration={22}>
            {brief.offer.price}
          </ShineText>
          <Sequence from={Math.round(fps * 0.5)} layout="none">
            <div style={{ position: "absolute", left: 0, top: 0, width: 420, height: 200 }}>
              <Sparkles x={45} y={50} spread={80} count={8} seed="price" />
            </div>
          </Sequence>
        </div>
      ) : null}
      <div style={{ height: 6, width: 300 * b, background: t.rule, margin: "34px 0" }} />
      <div style={{ ...serif(60, t.accent), opacity: c, maxWidth: 850 }}>{brief.offer.detail}</div>
    </Center>
  );
};

const Terms: React.FC<{ brief: OfferBrief; dur: number }> = ({ brief, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.5);
  const until = new Date(`${brief.offer.valid_until}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <Center dur={dur}>
      <div style={{ ...mono(30, t.accent), opacity: a }}>Valid until</div>
      <div style={{ ...headline(110), marginTop: 18, opacity: a }}>{until}</div>
      <div
        style={{
          ...mono(30, t.muted),
          marginTop: 46,
          opacity: a,
          textTransform: "none",
          letterSpacing: "0.04em",
          lineHeight: 1.5,
          maxWidth: 820,
        }}
      >
        {brief.offer.terms}
      </div>
    </Center>
  );
};
