import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { video } from "../brand";
import { Backdrop } from "../templates/shared/Backdrop";
import { headline, mono } from "../templates/shared/text";
import { ThemeContext, themes } from "../theme";
import {
  Checklist, ChartGrow, CoverStory, DigitalZoom, DoodleBoil, FrameBreak, GlassType, GreenScreen, HeadlineWall, Orbit, PaperCut, PhoneMockup,
  PhotoLayer, PullBackReveal, Subject, UIWorld, Vertigo, VideoWall, ZoomThrough,
} from "./footage";

export const FX_SEG = 90; // 3 s per effect
const CLIP = "footage/th-bleeding-gums.webm";

/** Full-frame "footage": the cut-out doctor over the brand backdrop. */
const Scene: React.FC<{ start?: number }> = ({ start = 0 }) => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ top: 520 }}>
      <Subject src={CLIP} startFrom={start} muted />
    </AbsoluteFill>
  </AbsoluteFill>
);
const Cut: React.FC<{ start?: number; top?: number }> = ({ start = 0, top = 520 }) => (
  <AbsoluteFill style={{ top }}>
    <Subject src={CLIP} startFrom={start} muted />
  </AbsoluteFill>
);

const DEMOS: { name: string; node: React.ReactNode }[] = [
  { name: "01 Orbit", node: <><Backdrop /><Orbit><Scene start={30} /></Orbit></> },
  { name: "02 Video wall", node: <VideoWall><Scene start={60} /></VideoWall> },
  { name: "03 UI world", node: <UIWorld subject={<Subject src={CLIP} startFrom={90} muted />} /> },
  { name: "04 Frame break", node: <FrameBreak background={<PhotoLayer src="cases/demo-molar/after.jpg" dim={0.25} />} subject={<Cut start={120} top={380} />} /> },
  { name: "05 Digital zoom", node: <DigitalZoom at={20}><Scene start={150} /></DigitalZoom> },
  { name: "06 Phone mockup", node: <><Backdrop /><PhoneMockup><Scene start={180} /></PhoneMockup></> },
  { name: "07 Checklist", node: <><Scene start={210} /><Checklist title="bonding" items={["Exam & shade", "Gentle prep", "Layer composite", "Polish"]} every={14} /></> },
  { name: "08 Headline wall", node: <HeadlineWall headlines={["Bleeding gums?", "Myth: hard brushing cleans better", "1 in 10 adults", "Floss daily", "Check-ups matter", "Healthy gums don't bleed"]} subject={<Subject src={CLIP} startFrom={240} muted />} /> },
  { name: "09 Zoom-through cut", node: <ZoomThrough from={<Scene start={270} />} to={<PhotoLayer src="cases/demo-molar/after.jpg" />} at={30} cx={540} cy={820} /> },
  { name: "10 Chart grow", node: <><Backdrop /><ChartGrow title="Gum bleeding risk" bars={[{ label: "Daily floss", value: 18 }, { label: "Sometimes", value: 42 }, { label: "Never", value: 71 }]} /></> },
  { name: "11 Pull-back reveal", node: <PullBackReveal at={10}><Scene start={300} /></PullBackReveal> },
  { name: "12 Green screen", node: <GreenScreen background={<PhotoLayer src="cases/demo-molar/before.jpg" />} subject={<Cut start={330} />} /> },
  { name: "13 Paper cut", node: <PaperCut><Scene start={360} /></PaperCut> },
  { name: "14 Doodle boil", node: <><Scene start={390} /><DoodleBoil /></> },
  { name: "15 Vertigo", node: <Vertigo background={<PhotoLayer src="cases/demo-molar/after.jpg" />} subject={<Cut start={420} />} amount={0.7} /> },
  { name: "16 Cover story", node: <CoverStory subject={<Subject src={CLIP} startFrom={450} muted />} lines={["Bleeding gums: what they mean", "4 causes", "Floss or brush?", "Dr. Ayesha explains"]} /> },
  { name: "17 Glass type", node: <GlassType text="Smile"><Scene start={480} /></GlassType> },
];
export const footageGalleryFrames = DEMOS.length * FX_SEG;

export const FootageGallery: React.FC = () => (
  <ThemeContext.Provider value={themes.brand}>
    <AbsoluteFill style={{ background: "#000", color: themes.brand.text }}>
      {DEMOS.map((d, i) => (
        <Sequence key={d.name} from={i * FX_SEG} durationInFrames={FX_SEG}>
          {d.node}
          <div style={{ position: "absolute", left: 90, top: 250, right: video.safe.right }}>
            <div style={mono(24, themes.brand.accent)}>Footage effect</div>
            <div style={{ ...headline(64), textShadow: "0 3px 16px rgba(0,0,0,0.6)" }}>{d.name}</div>
          </div>
        </Sequence>
      ))}
    </AbsoluteFill>
  </ThemeContext.Provider>
);
