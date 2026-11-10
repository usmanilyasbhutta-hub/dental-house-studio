import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { video } from "../brand";
import { Backdrop } from "../templates/shared/Backdrop";
import { headline, mono } from "../templates/shared/text";
import { ThemeContext, themes } from "../theme";
import { PhotoLayer, PunchCaption, Subject } from "./footage";
import {
  BrandDuotone, Countdown, FreezeIntro, LocationPin, MulticamGrid, NotificationStack, PostMockup, ShapeReveal, Spotlight, TextRing, WhipPan, WordStack,
} from "./footage2";

export const FX2_SEG = 90;
const CLIP = "footage/th-bleeding-gums.webm";
const Doc: React.FC<{ start: number; top?: number }> = ({ start, top = 560 }) => <AbsoluteFill style={{ top }}><Subject src={CLIP} startFrom={start} muted /></AbsoluteFill>;
const Scene: React.FC<{ start: number }> = ({ start }) => <AbsoluteFill><Backdrop /><Doc start={start} /></AbsoluteFill>;
const Room = () => <Backdrop />;

const DEMOS: { name: string; node: React.ReactNode }[] = [
  { name: "19 Text ring", node: <TextRing background={<Room />} subject={<Doc start={30} />} text="CONSULT FIRST" /> },
  { name: "20 Spotlight", node: <Spotlight background={<PhotoLayer src="cases/demo-molar/after.jpg" />} subject={<Doc start={60} />} /> },
  { name: "21 Whip pan", node: <WhipPan from={<Scene start={90} />} to={<PhotoLayer src="cases/demo-molar/after.jpg" />} at={36} /> },
  { name: "22 Shape reveal", node: <ShapeReveal from={<Scene start={120} />} to={<PhotoLayer src="cases/demo-case/after.png" />} at={22} shape="tooth" /> },
  { name: "23 Freeze intro", node: <FreezeIntro background={<Room />} subject={<Doc start={150} />} name="Dr. Ayesha Sarfraz" role="BDS, RDS · DENTAL HOUSE" hold={50} /> },
  { name: "24 Notifications", node: <><Scene start={180} /><NotificationStack items={[{ app: "DENTAL HOUSE", title: "Appointment confirmed", body: "Tue 5:30 pm, check-up" }, { app: "DENTAL HOUSE", title: "Reminder", body: "Brush twice a day" }, { app: "WHATSAPP", title: "Dental House", body: "See you tomorrow!" }]} /></> },
  { name: "25 Location pin", node: <LocationPin /> },
  { name: "26 Countdown", node: <><Room /><Countdown from={14} to={7} unit="DAYS LEFT" label="Free consultation ends in" /></> },
  { name: "27 Post mockup", node: <PostMockup><Scene start={240} /></PostMockup> },
  { name: "28 Multicam grid", node: <MulticamGrid panel={(i) => <Scene start={270 + i * 6} />} /> },
  { name: "29 Word stack", node: <><Room /><WordStack words={["Healthy", "gums", "don't", "bleed."]} accent={1} /></> },
  { name: "30 Brand duotone", node: <><BrandDuotone><Scene start={330} /></BrandDuotone><PunchCaption words="calm, clean, clinical" keyword="calm," y={1300} /></> },
];
export const footageGallery2Frames = DEMOS.length * FX2_SEG;

export const FootageGallery2: React.FC = () => (
  <ThemeContext.Provider value={themes.brand}>
    <AbsoluteFill style={{ background: "#000", color: themes.brand.text }}>
      {DEMOS.map((d, i) => (
        <Sequence key={d.name} from={i * FX2_SEG} durationInFrames={FX2_SEG}>
          {d.node}
          <div style={{ position: "absolute", left: 90, top: 240, right: video.safe.right }}>
            <div style={mono(24, themes.brand.accent)}>Footage effect</div>
            <div style={{ ...headline(60), textShadow: "0 3px 16px rgba(0,0,0,0.6)" }}>{d.name}</div>
          </div>
        </Sequence>
      ))}
    </AbsoluteFill>
  </ThemeContext.Provider>
);
