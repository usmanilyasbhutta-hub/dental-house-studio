import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Backdrop } from "../templates/shared/Backdrop";
import { KineticHeadline } from "../templates/shared/Headline";
import { headline, mono } from "../templates/shared/text";
import { ThemeContext, themes } from "../theme";
import { Subject } from "./footage";
import { LOOKS, Look } from "./looks";

export const LOOK_SEG = 75;
const shown = LOOKS.filter((l) => l !== "none");
export const looksGalleryFrames = (shown.length + 1) * LOOK_SEG;

const Scene: React.FC<{ start: number }> = ({ start }) => (
  <AbsoluteFill style={{ color: themes.brand.text }}>
    <Backdrop />
    <AbsoluteFill style={{ top: 560 }}><Subject src="footage/th-bleeding-gums.webm" startFrom={start} muted /></AbsoluteFill>
    <div style={{ position: "absolute", left: 90, top: 300 }}><KineticHeadline lines={["Healthy gums", "don't bleed"]} accent="bleed" width={820} max={110} /></div>
  </AbsoluteFill>
);

/** Whole-video looks on one clinic shot (needs the local footage). First segment: no look, for comparison. */
export const LooksGallery: React.FC = () => (
  <ThemeContext.Provider value={themes.brand}>
    <AbsoluteFill style={{ background: "#000" }}>
      {["none", ...shown].map((l, i) => (
        <Sequence key={l} from={i * LOOK_SEG} durationInFrames={LOOK_SEG}>
          <Look kind={l as (typeof LOOKS)[number]}><Scene start={i * 40} /></Look>
          <div style={{ position: "absolute", left: 90, bottom: 420 }}>
            <div style={mono(22, themes.brand.accent)}>Look</div>
            <div style={{ ...headline(56, "#fff"), textShadow: "0 3px 16px rgba(0,0,0,0.7)" }}>{l === "none" ? "Original" : l}</div>
          </div>
        </Sequence>
      ))}
    </AbsoluteFill>
  </ThemeContext.Provider>
);
