import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, video } from "../brand";
import type { EducationBrief } from "../brief/schema";
import { scenes, sec } from "../brief/timing";
import { KineticHeadline } from "./shared/Headline";
import { prog, sceneFade } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { Step } from "./shared/Step";
import { mono, serif } from "./shared/text";

const s = scenes.education;

export const Education: React.FC<{ brief: EducationBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  let t = 0;
  const at = (d: number) => {
    const from = sec(t, fps);
    t += d;
    return { from, durationInFrames: sec(d, fps) };
  };
  return (
    <Shell brief={brief} endSeconds={s.end} showSafeZones={showSafeZones}>
      <Sequence {...at(s.hook)}>
        <Pad dur={sec(s.hook, fps)}>
          <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} />
        </Pad>
      </Sequence>
      {brief.steps.map((st, i) => (
        <Sequence key={i} {...at(s.step)}>
          <Step n={i + 1} title={st.title} subline={st.subline} dur={sec(s.step, fps)} />
        </Sequence>
      ))}
      <Sequence {...at(s.takeaway)}>
        <Takeaway text={brief.takeaway} dur={sec(s.takeaway, fps)} />
      </Sequence>
      <Sequence {...at(s.sources)}>
        <Sources brief={brief} dur={sec(s.sources, fps)} />
      </Sequence>
    </Shell>
  );
};

const Pad: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 90, paddingRight: video.safe.right, opacity: sceneFade(frame, dur) }}>
      {children}
    </AbsoluteFill>
  );
};

const Takeaway: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.7);
  return (
    <Pad dur={dur}>
      <div style={{ ...mono(30, colors.bronzeLight), opacity: a }}>Remember</div>
      <div style={{ ...serif(92, colors.white), marginTop: 30, opacity: a, transform: `translateY(${(1 - a) * 30}px)`, maxWidth: 850 }}>{text}</div>
    </Pad>
  );
};

const Sources: React.FC<{ brief: EducationBrief; dur: number }> = ({ brief, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.5);
  return (
    <Pad dur={dur}>
      <div style={{ opacity: a }}>
        <div style={mono(28, colors.bronzeLight)}>Sources</div>
        {brief.sources.slice(0, 3).map((x, i) => (
          <div key={i} style={{ ...mono(24, colors.mist), textTransform: "none", letterSpacing: "0.02em", lineHeight: 1.5, marginTop: 22, maxWidth: 840 }}>
            {x.citation}
            {x.pmid ? ` · PMID ${x.pmid}` : ""}
          </div>
        ))}
        <div style={{ ...mono(24, colors.mist), textTransform: "none", letterSpacing: "0.02em", marginTop: 46, maxWidth: 840, lineHeight: 1.5 }}>
          General information, not a diagnosis. Book a check-up for advice on your own teeth.
        </div>
      </div>
    </Pad>
  );
};
