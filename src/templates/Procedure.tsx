import React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { video } from "../brand";
import type { ProcedureBrief } from "../brief/schema";
import { useTheme } from "../theme";
import { Abutment, Crown, DentalLights, Implant, JawSection, PreparedTooth, Tooth } from "../three/dental";
import { CompositeScene } from "../three/CompositeScene";
import { Sfx } from "../fx/effects";
import { prog } from "./shared/motion";
import { KineticHeadline } from "./shared/Headline";
import { Shell, type QcProps } from "./shared/Shell";
import { fitSize, headline, mono, serif } from "./shared/text";

const STAGE3D = { top: 470, height: 980 };
export const HOOK_SECONDS = 2;
const ease = Easing.bezier(0.33, 1, 0.68, 1);
const land = (local: number, from: number, to: number, start = 0.1, end = 0.7) =>
  interpolate(local, [start, end], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** 3D procedure explainer. Stage progress comes from the frame number, so every render is identical. */
export const Procedure: React.FC<{ brief: ProcedureBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  const per = Math.round(brief.seconds_per_step * fps);
  const hook = Math.round(HOOK_SECONDS * fps);
  const steps = brief.steps.length * per;
  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones}>
      <Sequence durationInFrames={hook}>
        <div style={{ position: "absolute", left: 90, top: 255 }}>
          <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} width={850} max={120} />
        </div>
      </Sequence>
      <Sequence durationInFrames={hook + steps + (brief.takeaway ? Math.round(2.6 * fps) : 0)}>
        <Model brief={brief} per={per} offset={hook} />
      </Sequence>
      <Sequence from={hook} durationInFrames={steps + (brief.takeaway ? Math.round(2.6 * fps) : 0)}>
        {brief.steps.map((s, i) => (
          <Sequence key={i} from={i * per} durationInFrames={per}>
            <StepCard n={i + 1} total={brief.steps.length} title={s.title} subline={s.subline} dur={per} />
            <Sfx name={i === 0 ? "whoosh" : i === brief.steps.length - 1 ? "thud" : "pop"} at={i === 0 ? 0 : Math.round(per * 0.55)} volume={0.4} />
          </Sequence>
        ))}
        {brief.takeaway ? (
          <Sequence from={steps}>
            <Takeaway text={brief.takeaway} />
          </Sequence>
        ) : null}
        <div style={{ position: "absolute", right: video.safe.right + 10, top: STAGE3D.top + 6, ...mono(20) }}>Illustration · not to scale</div>
      </Sequence>
    </Shell>
  );
};

/** Aim the default camera (ThreeCanvas has no lookAt prop). */
const Aim: React.FC<{ y: number }> = ({ y }) => {
  const camera = useThree((s) => s.camera);
  camera.lookAt(0, y, 0);
  return null;
};

const Model: React.FC<{ brief: ProcedureBrief; per: number; offset: number }> = ({ brief, per, offset }) => {
  const raw = useCurrentFrame();
  const frame = Math.max(0, raw - offset); // stages start after the hook; the model is visible from frame 0
  const stage = Math.min(brief.steps.length - 1, Math.floor(frame / per));
  const local = (frame - stage * per) / per; // 0..1 inside the current stage
  const after = (k: number) => (stage > k ? 1 : stage === k ? local : 0); // progress of stage k
  const turn = Math.sin(raw / 55) * 0.32; // slow turntable so the 3D reads
  const enter = interpolate(raw, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, top: STAGE3D.top, width: video.width, height: STAGE3D.height, opacity: enter }}>
      <ThreeCanvas width={video.width} height={STAGE3D.height} camera={{ position: [0, 0.9, 6.4], fov: 32 }} gl={{ antialias: true, alpha: true }}>
        {brief.procedure === "composite" ? (
          <CompositeScene after={after} frame={raw} stage={stage} pullBack={interpolate(frame, [brief.steps.length * per - 10, brief.steps.length * per + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
        ) : (
          <>
            <Aim y={-0.35} />
            <DentalLights />
            <group rotation={[0.08, turn, 0]}>
              <JawSection />
              <Tooth position={[-0.95, 0, 0]} />
              <Tooth position={[0.95, 0, 0]} />
              {brief.procedure === "implant" ? <ImplantStages after={after} /> : <CrownStages after={after} />}
            </group>
          </>
        )}
      </ThreeCanvas>
    </div>
  );
};

const ImplantStages: React.FC<{ after: (k: number) => number }> = ({ after }) => {
  const p1 = after(1), p2 = after(2), p3 = after(3);
  const implantY = land(p1, 2.6, -0.2, 0.05, 0.8);
  const spin = land(p1, 0, Math.PI * 2 * 5, 0.05, 0.8); // screws in as it descends
  return (
    <>
      {p1 > 0 ? <Implant position={[0, implantY, 0]} rotationY={spin} /> : null}
      {p2 > 0 ? <Abutment position={[0, land(p2, 2.4, -0.2), 0]} /> : null}
      {p3 > 0 ? <Crown position={[0, land(p3, 2.4, 0, 0.1, 0.65), 0]} /> : null}
    </>
  );
};

const CrownStages: React.FC<{ after: (k: number) => number }> = ({ after }) => {
  const p1 = after(1), p2 = after(2);
  const reduce = land(p1, 0, 1, 0.15, 0.75);
  return (
    <>
      {p1 === 0 ? <Tooth decay={1} /> : <PreparedTooth reduce={reduce} />}
      {p2 > 0 ? <Crown position={[0, land(p2, 2.4, 0, 0.1, 0.65), 0]} /> : null}
    </>
  );
};

const StepCard: React.FC<{ n: number; total: number; title: string; subline: string; dur: number }> = ({ n, total, title, subline, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.45);
  const out = interpolate(frame, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", left: 90, right: video.safe.right, top: 255, opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={mono(28, t.accent)}>
            Step {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {Array.from({ length: total }, (_, i) => (
              <div key={i} style={{ width: i + 1 === n ? 40 : 12, height: 8, borderRadius: 4, background: i + 1 <= n ? t.accent : t.muted, opacity: i + 1 <= n ? 1 : 0.4 }} />
            ))}
          </div>
        </div>
        <div style={{ ...headline(fitSize([title], 850, 104)), marginTop: 10 }}>{title}</div>
      </div>
      <div style={{ position: "absolute", left: 90, right: video.safe.right, top: 1420, ...serif(54, t.accent), opacity: prog(frame, fps * 0.3, fps * 0.5) }}>{subline}</div>
    </AbsoluteFill>
  );
};

const Takeaway: React.FC<{ text: string }> = ({ text }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.5);
  return (
    <div style={{ position: "absolute", left: 90, right: video.safe.right, top: 1400, ...serif(64, t.text), opacity: a }}>{text}</div>
  );
};
