import React from "react";
import { useTheme } from "../theme";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { video } from "../brand";
import type { OfferBrief } from "../brief/schema";
import { scenes, sec } from "../brief/timing";
import { KineticHeadline } from "./shared/Headline";
import { prog, sceneFade } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { Step } from "./shared/Step";
import { fitSize, headline, mono, serif } from "./shared/text";

const s = scenes.offer;

export const Offer: React.FC<{ brief: OfferBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  let cursor = 0;
  const at = (d: number) => {
    const from = sec(cursor, fps);
    cursor += d;
    return { from, durationInFrames: sec(d, fps) };
  };
  return (
    <Shell brief={brief} endSeconds={s.end} showSafeZones={showSafeZones}>
      <Sequence {...at(s.hook)}>
        <Center dur={sec(s.hook, fps)}>
          <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} />
        </Center>
      </Sequence>
      <Sequence {...at(s.reveal)}>
        <Reveal brief={brief} dur={sec(s.reveal, fps)} />
      </Sequence>
      {brief.points.map((p, i) => (
        <Sequence key={i} {...at(s.point)}>
          <Step n={i + 1} title={p} dur={sec(s.point, fps)} />
        </Sequence>
      ))}
      <Sequence {...at(s.terms)}>
        <Terms brief={brief} dur={sec(s.terms, fps)} />
      </Sequence>
    </Shell>
  );
};

const Center: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 90, paddingRight: video.safe.right, opacity: sceneFade(frame, dur) }}>
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
      <div style={{ ...mono(30, t.accent), opacity: a }}>Limited offer</div>
      <div style={{ ...headline(fitSize([brief.offer.headline], 850, 140)), marginTop: 26, opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>
        {brief.offer.headline}
      </div>
      {brief.offer.price ? (
        <div style={{ ...headline(fitSize([brief.offer.price], 850, 170), t.accent), marginTop: 18, opacity: b, transform: `scale(${0.9 + 0.1 * b})`, transformOrigin: "left" }}>
          {brief.offer.price}
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
  const until = new Date(`${brief.offer.valid_until}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <Center dur={dur}>
      <div style={{ ...mono(30, t.accent), opacity: a }}>Valid until</div>
      <div style={{ ...headline(110), marginTop: 18, opacity: a }}>{until}</div>
      <div style={{ ...mono(30, t.muted), marginTop: 46, opacity: a, textTransform: "none", letterSpacing: "0.04em", lineHeight: 1.5, maxWidth: 820 }}>
        {brief.offer.terms}
      </div>
    </Center>
  );
};
