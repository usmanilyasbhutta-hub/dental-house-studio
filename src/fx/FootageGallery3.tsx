import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { video } from "../brand";
import { Backdrop } from "../templates/shared/Backdrop";
import { headline, mono } from "../templates/shared/text";
import { ThemeContext, themes } from "../theme";
import { BrandDuotone } from "./footage2";
import { PhotoLayer, Subject } from "./footage";
import { CubeSpin, GridDive, Particles, HeadPopOut, InfiniteZoom, LiquidGlass, MagnifyLens, PhoneFan, Portal, RibbonWrap, Shatter, TileTunnel } from "./footage3";

export const FX3F_SEG = 90;
const CLIP = "footage/th-bleeding-gums.webm";
const Doc: React.FC<{ start: number; top?: number }> = ({ start, top = 560 }) => <AbsoluteFill style={{ top }}><Subject src={CLIP} startFrom={start} muted /></AbsoluteFill>;
const Scene: React.FC<{ start: number }> = ({ start }) => <AbsoluteFill><Backdrop /><Doc start={start} /></AbsoluteFill>;
const Room = () => <Backdrop />;
const Photo = () => <PhotoLayer src="cases/demo-molar/after.jpg" />;

const DEMOS: { name: string; node: React.ReactNode }[] = [
  { name: "39 Grid dive", node: <GridDive panel={(i) => (i === 4 ? <Scene start={30} /> : <BrandDuotone amount={0.7}><Scene start={30 + i * 20} /></BrandDuotone>)} at={26} /> },
  { name: "40 Magnifying lens", node: <MagnifyLens><Scene start={60} /></MagnifyLens> },
  { name: "41 Portal", node: <Portal from={<Scene start={90} />} to={<Photo />} at={10} /> },
  { name: "42 Infinite zoom", node: <InfiniteZoom><Scene start={120} /></InfiniteZoom> },
  { name: "43 Cube spin", node: <CubeSpin front={<Scene start={150} />} side={<Photo />} at={22} /> },
  { name: "44 Liquid glass", node: <LiquidGlass card={{ title: "Gum check", body: "Ask at your next visit" }}><Scene start={180} /></LiquidGlass> },
  { name: "45 Tile tunnel", node: <TileTunnel tiles={[<Photo key="a" />, <PhotoLayer key="b" src="cases/demo-molar/before.jpg" />, <Room key="c" />]} end={<Scene start={210} />} settle={58} /> },
  { name: "46 Phone fan", node: <PhoneFan screen={(i) => (i === 2 ? <Scene start={240} /> : i % 2 ? <Photo /> : <Room />)} /> },
  { name: "47 Shatter", node: <Shatter from={<Scene start={270} />} to={<Photo />} at={30} /> },
  { name: "48 Ribbon wrap", node: <RibbonWrap background={<Room />} subject={<Doc start={300} />} text="HEALTHY GUMS" /> },
  { name: "50 Particles", node: <><Room /><Particles mode="spiral" /><Particles mode="dust" seed="d" count={60} /></> },
  { name: "49 Head pop-out", node: <HeadPopOut background={<Room />} subject={<Doc start={330} />} /> },
];
export const footageGallery3Frames = DEMOS.length * FX3F_SEG;

/** Set 4: the effects from the "20 video effects for Claude" reel we didn't have yet (needs the local clinic footage). */
export const FootageGallery3: React.FC = () => (
  <ThemeContext.Provider value={themes.brand}>
    <AbsoluteFill style={{ background: "#000", color: themes.brand.text }}>
      {DEMOS.map((d, i) => (
        <Sequence key={d.name} from={i * FX3F_SEG} durationInFrames={FX3F_SEG}>
          {d.node}
          <div style={{ position: "absolute", left: 90, top: 240, right: video.safe.right }}>
            <div style={mono(24, themes.brand.accent)}>Footage effect · set 4</div>
            <div style={{ ...headline(60), textShadow: "0 3px 16px rgba(0,0,0,0.6)" }}>{d.name}</div>
          </div>
        </Sequence>
      ))}
    </AbsoluteFill>
  </ThemeContext.Provider>
);
