import React from "react";
import { useTheme } from "../theme";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { video } from "../brand";
import type { EducationBrief } from "../brief/schema";
import { scenes, sec } from "../brief/timing";
import { KineticHeadline } from "./shared/Headline";
import { prog, sceneFade } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { Scenes, useEdgeFade } from "../fx/Scenes";
import { Step } from "./shared/Step";
import { mono, serif } from "./shared/text";

const s = scenes.education;

export const Education: React.FC<{ brief: EducationBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  return (
    <Shell brief={brief} endSeconds={s.end} showSafeZones={showSafeZones}>
      <Scenes
        items={[
          {
            seconds: s.hook,
            node: (
              <>
                <Pad dur={sec(s.hook, fps)}>
                  <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} />
                </Pad>
              </>
            ),
          },
          ...brief.steps.map((st, i) => ({
            seconds: s.step,
            node: (
              <>
                <Step n={i + 1} title={st.title} subline={st.subline} dur={sec(s.step, fps)} />
              </>
            ),
          })),
          {
            seconds: s.takeaway,
            node: (
              <>
                <Takeaway text={brief.takeaway} dur={sec(s.takeaway, fps)} />
              </>
            ),
          },
          {
            seconds: s.sources,
            node: (
              <>
                <Sources brief={brief} dur={sec(s.sources, fps)} />
              </>
            ),
          },
        ]}
      />
    </Shell>
  );
};

const Pad: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
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

const Takeaway: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.7);
  return (
    <Pad dur={dur}>
      <div style={{ ...mono(30, t.accent), opacity: a }}>Remember</div>
      <div style={{ ...serif(92, t.text), marginTop: 30, opacity: a, transform: `translateY(${(1 - a) * 30}px)`, maxWidth: 850 }}>
        {text}
      </div>
    </Pad>
  );
};

const Sources: React.FC<{ brief: EducationBrief; dur: number }> = ({ brief, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.5);
  return (
    <Pad dur={dur}>
      <div style={{ opacity: a }}>
        <div style={mono(28, t.accent)}>Sources</div>
        {brief.sources.slice(0, 3).map((x, i) => (
          <div
            key={i}
            style={{ ...mono(24, t.muted), textTransform: "none", letterSpacing: "0.02em", lineHeight: 1.5, marginTop: 22, maxWidth: 840 }}
          >
            {x.citation}
            {x.pmid ? ` · PMID ${x.pmid}` : ""}
          </div>
        ))}
        <div
          style={{ ...mono(24, t.muted), textTransform: "none", letterSpacing: "0.02em", marginTop: 46, maxWidth: 840, lineHeight: 1.5 }}
        >
          General information, not a diagnosis. Book a check-up for advice on your own teeth.
        </div>
      </div>
    </Pad>
  );
};
