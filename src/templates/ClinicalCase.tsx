import React from "react";
import { useTheme } from "../theme";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { video } from "../brand";
import type { CaseBrief } from "../brief/schema";
import { scenes, sec } from "../brief/timing";
import { KineticHeadline } from "./shared/Headline";
import { easeInOut, prog, sceneFade } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { Scenes, useEdgeFade } from "../fx/Scenes";
import { headline, mono, serif } from "./shared/text";

const s = scenes.case;
const CARD = { w: 900, h: 1100, top: 380 };

/**
 * Before/after case. Photos are shown UNWARPED and uncropped (object-fit: contain,
 * identical box for both) so the comparison stays honest.
 */
export const ClinicalCase: React.FC<{ brief: CaseBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  const t = useTheme();
  return (
    <Shell brief={brief} endSeconds={s.end} showSafeZones={showSafeZones}>
      <Scenes
        items={[
          {
            seconds: s.hook,
            node: (
              <>
                <Fade dur={sec(s.hook, fps)}>
                  <div style={{ ...mono(30, t.accent), marginBottom: 30 }}>Clinical case · {brief.treatment}</div>
                  <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} />
                </Fade>
              </>
            ),
          },
          {
            seconds: s.before,
            node: (
              <>
                <Photo src={brief.before} tag="Before" dur={sec(s.before, fps)} />
              </>
            ),
          },
          {
            seconds: s.wipe,
            node: (
              <>
                <Wipe before={brief.before} after={brief.after} dur={sec(s.wipe, fps)} />
              </>
            ),
          },
          {
            seconds: s.after,
            node: (
              <>
                <Photo src={brief.after} tag="After" dur={sec(s.after, fps)} />
              </>
            ),
          },
          {
            seconds: s.notes,
            node: (
              <>
                <Notes brief={brief} dur={sec(s.notes, fps)} />
              </>
            ),
          },
          {
            seconds: s.disclaimer,
            node: (
              <>
                <Fade dur={sec(s.disclaimer, fps)}>
                  <div style={serif(76, t.text)}>Every smile is different.</div>
                  <div
                    style={{
                      ...mono(28, t.muted),
                      textTransform: "none",
                      letterSpacing: "0.03em",
                      lineHeight: 1.55,
                      marginTop: 36,
                      maxWidth: 820,
                    }}
                  >
                    Individual results vary. Photos are unedited and shared with the patient's written consent.
                  </div>
                </Fade>
              </>
            ),
          },
        ]}
      />
    </Shell>
  );
};

const Fade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
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

const frameBox: React.CSSProperties = {
  position: "absolute",
  left: (video.width - CARD.w) / 2,
  top: CARD.top,
  width: CARD.w,
  height: CARD.h,
  borderRadius: 28,
  overflow: "hidden",
  background: "#0e1211",
  boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
};
const photo: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" };

const Tag: React.FC<{ text: string; side?: "left" | "right" }> = ({ text, side = "left" }) => {
  const t = useTheme();
  return <div style={{ position: "absolute", top: CARD.top - 74, [side]: (video.width - CARD.w) / 2, ...mono(32, t.accent) }}>{text}</div>;
};

const Photo: React.FC<{ src: string; tag: string; dur: number }> = ({ src, tag, dur }) => {
  const frame = useCurrentFrame();
  const edge = useEdgeFade();
  return (
    <AbsoluteFill style={{ opacity: sceneFade(frame, dur, 8, edge) }}>
      <Tag text={tag} />
      <div style={frameBox}>
        <Img src={staticFile(src)} style={photo} />
      </div>
    </AbsoluteFill>
  );
};

const Wipe: React.FC<{ before: string; after: string; dur: number }> = ({ before, after, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const edge = useEdgeFade();
  const { fps } = useVideoConfig();
  // sweep to the right, peek back, settle on "after"
  const x = interpolate(frame, [fps * 0.2, fps * 1.4, fps * 2.0, fps * 2.7], [0, 0.72, 0.45, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeInOut,
  });
  const lbl = prog(frame, 0, fps * 0.4);
  return (
    <AbsoluteFill style={{ opacity: sceneFade(frame, dur, 4, edge) }}>
      <div style={{ opacity: lbl }}>
        <Tag text="Before" />
        <Tag text="After" side="right" />
      </div>
      <div style={frameBox}>
        <Img src={staticFile(before)} style={photo} />
        <Img src={staticFile(after)} style={{ ...photo, clipPath: `inset(0 ${(1 - x) * 100}% 0 0)` }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x * 100}%`, width: 6, marginLeft: -3, background: t.accent }} />
      </div>
    </AbsoluteFill>
  );
};

const Notes: React.FC<{ brief: CaseBrief; dur: number }> = ({ brief, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Fade dur={dur}>
      <div style={mono(30, t.accent)}>What we did</div>
      {brief.notes.map((n, i) => {
        const a = prog(frame, fps * (0.15 + i * 0.25), fps * 0.5);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 28,
              marginTop: 34,
              opacity: a,
              transform: `translateX(${(1 - a) * -40}px)`,
            }}
          >
            <div style={{ ...headline(44, t.accent) }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={headline(64)}>{n}</div>
          </div>
        );
      })}
      {brief.timeline ? <div style={{ ...serif(56, t.accent), marginTop: 50 }}>{brief.timeline}</div> : null}
    </Fade>
  );
};
