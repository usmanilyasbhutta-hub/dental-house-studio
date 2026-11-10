import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { clinic } from "../brand";
import { headline, mono } from "../templates/shared/text";
import { ThemeContext, themes } from "../theme";
import { HalftoneReveal } from "./Halftone";
import { DataCity, FX3_SEG, Newspaper, Teardown, demoGrid } from "./reel3";

const paper = (
  <Newspaper
    masthead="The Dental House Times"
    edition={`${clinic.city} edition · demo`}
    headline="Two doctors, one calm clinic"
    deck="A consultation comes first, every time."
    image="cases/demo-molar/after.jpg"
    imageCaption="Illustration (synthetic image, not a patient)."
    body={`${clinic.name} on Commissioner Road, ${clinic.city}, sees patients for check-ups, fillings, crowns and implants. ${clinic.doctors[0]} and ${clinic.doctors[1]} explain every option before treatment starts, so you know what to expect and why. Bring your questions; we will go through them with you.`}
  />
);

const DEMOS: { name: string; node: React.ReactNode }[] = [
  { name: "31 Data city", node: <DataCity values={demoGrid()} caption="Demo data · use real numbers only" /> },
  { name: "32 Teardown", node: <Teardown /> },
  { name: "33 Front page", node: paper },
  { name: "34 Halftone reveal", node: <>{paper}<HalftoneReveal duration={40} delay={10} /></> },
];
export const effectsGallery3Frames = DEMOS.length * FX3_SEG;

/** Effects set 3 (reference reel: git-city / teardown / headline). Map route: brief type `map-route`. */
export const EffectsGallery3: React.FC = () => (
  <ThemeContext.Provider value={themes.brand}>
    <AbsoluteFill style={{ background: "#000", color: themes.brand.text }}>
      {DEMOS.map((d, i) => (
        <Sequence key={d.name} from={i * FX3_SEG} durationInFrames={FX3_SEG}>
          {d.node}
          <div style={{ position: "absolute", left: 70, top: 1600 }}>
            <div style={mono(22, themes.brand.accent)}>Effect · set 3</div>
            <div style={{ ...headline(52), textShadow: "0 3px 16px rgba(0,0,0,0.6)" }}>{d.name}</div>
          </div>
        </Sequence>
      ))}
    </AbsoluteFill>
  </ThemeContext.Provider>
);
