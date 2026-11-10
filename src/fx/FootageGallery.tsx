import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { video } from "../brand";
import { Backdrop } from "../templates/shared/Backdrop";
import { headline, mono } from "../templates/shared/text";
import { ThemeContext, themes } from "../theme";
import {
  Checklist, CouchWall, CoverStory, DigitalZoom, DoodleBoil, FrameBreak, GlassType, GreenScreen, HeadlineWall, Orbit, PaperCut, PhoneBeside,
  PhotoLayer, PullBackReveal, PunchCaption, Subject, TrendLine, UIWorld, Vertigo, ZoomThrough,
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

const IMG = (src: string) => <PhotoLayer src={src} />;
const PHOTOS = ["cases/demo-molar/after.jpg", "cases/demo-molar/before.jpg", "cases/demo-case/after.png", "cases/demo-case/before.png", "brand/logo.png"];
const tile = (i: number) => (i % 5 === 4 ? <AbsoluteFill style={{ background: "#F7F8F6", padding: 16 }}><img src={staticFile("brand/logo.png")} style={{ width: "100%" }} /></AbsoluteFill> : IMG(PHOTOS[i % 4]));
/** The doctor (cut-out) positioned like a seated presenter. */
const Doc: React.FC<{ start: number; top?: number }> = ({ start, top = 560 }) => <AbsoluteFill style={{ top }}><Subject src={CLIP} startFrom={start} muted /></AbsoluteFill>;
const Room = () => <Backdrop />;

const DEMOS: { name: string; node: React.ReactNode }[] = [
  { name: "01 Orbit", node: <Orbit background={<Room />} subject={<Doc start={30} />} cards={[0, 1, 2, 3, 4].map(tile)} /> },
  { name: "02 Couch wall", node: <><CouchWall background={<Room />} subject={<Doc start={60} />} tiles={Array.from({ length: 12 }, (_, i) => tile(i))} /><PunchCaption words="your smile, our work" keyword="smile" y={1290} /></> },
  { name: "03 UI world", node: <UIWorld background={<Room />} subject={<Doc start={90} top={760} />} thumbs={[0, 1, 2, 3].map(tile)} prompt="Make a reel from these clips" /> },
  { name: "04 Frame break", node: <FrameBreak background={<PhotoLayer src="cases/demo-molar/after.jpg" dim={0.25} />} subject={<Cut start={120} top={380} />} /> },
  { name: "05 Digital zoom", node: <><DigitalZoom at={20}><Scene start={150} /></DigitalZoom><PunchCaption words="gentle brushing" keyword="gentle" y={1300} /></> },
  { name: "06 Phone beside", node: <><Scene start={180} /><PhoneBeside screen={<AbsoluteFill style={{ padding: 24, gap: 14, display: "flex", flexDirection: "column" }}>{["Book a check-up", "Tue 5:30 pm", "WhatsApp 0323-7560160"].map((t2) => <div key={t2} style={{ background: "#2B3D35", color: "#F3F1E6", borderRadius: 16, padding: "14px 16px", fontFamily: "Oswald", fontSize: 26 }}>{t2}</div>)}</AbsoluteFill>} /></> },
  { name: "07 Checklist", node: <><Scene start={210} /><Checklist title="bonding" items={["Exam & shade", "Gentle prep", "Layer composite", "Polish"]} every={14} /></> },
  { name: "08 Headline wall", node: <HeadlineWall background={<Room />} subject={<Doc start={240} />} every={4} headlines={["Myth: hard brushing cleans better", "Bleeding gums? Get checked", "Floss daily", "1 in 10 adults", "Healthy gums don't bleed", "Check-ups matter", "Soft brush, light pressure", "Your smile has a home"]} /> },
  { name: "09 Zoom-through cut", node: <ZoomThrough from={<Scene start={270} />} to={<PhotoLayer src="cases/demo-molar/after.jpg" />} at={30} cx={540} cy={820} /> },
  { name: "10 Chart grow", node: <TrendLine subject={<Doc start={300} top={700} />} label="SMILES ↗" /> },
  { name: "11 Pull-back reveal", node: <PullBackReveal at={8} frames={26} device="editor"><Scene start={330} /></PullBackReveal> },
  { name: "12 Green screen", node: <GreenScreen background={<AbsoluteFill style={{ background: "linear-gradient(160deg,#6D5BD0,#2B3D35)" }}><div style={{ position: "absolute", top: 420, left: 90, right: 140, background: "#F7F8F6", borderRadius: 24, padding: 30, fontFamily: "Oswald", fontSize: 54, color: "#1C2220" }}>Book online · 24/7</div></AbsoluteFill>} subject={<Cut start={360} top={700} />} /> },
  { name: "13 Paper cut", node: <PaperCut subject={<Doc start={390} top={640} />} letters="100%" /> },
  { name: "14 Doodle boil", node: <><Room /><DoodleBoil subject={<Doc start={420} />} /><Doc start={420} /></> },
  { name: "15 Vertigo", node: <><Vertigo background={<PhotoLayer src="cases/demo-molar/after.jpg" />} subject={<Cut start={450} />} amount={0.7} /><PunchCaption words="strong healthy teeth" keyword="healthy" y={1300} /></> },
  { name: "16 Cover story", node: <CoverStory subject={<Subject src={CLIP} startFrom={480} muted />} masthead="SMILE" lines={["Bleeding gums: what they mean", "4 causes", "Floss or brush?", "Dr. Ayesha explains"]} /> },
  { name: "17 Glass type", node: <GlassType text="Smile" background={<Room />} subject={<Doc start={510} />} y={1000} size={320} /> },
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
