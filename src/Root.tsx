import React from "react";
import { Composition } from "remotion";
import { video } from "./brand";
import { brief as briefSchema } from "./brief/schema";
import { durationSeconds } from "./brief/timing";
import { demoCase, demoEducation, demoOffer } from "./demo-briefs";
import { loadBrandFonts } from "./templates/shared/fonts";
import { Video, type VideoProps } from "./Video";

loadBrandFonts();

const calc = ({ props }: { props: VideoProps }) => {
  const b = briefSchema.parse(props.brief); // fail loudly on bad props
  return { durationInFrames: Math.round(durationSeconds(b) * video.fps), props: { ...props, brief: b } };
};

const common = { component: Video, fps: video.fps, width: video.width, height: video.height, durationInFrames: 1, calculateMetadata: calc };

export const Root: React.FC = () => (
  <>
    {/* "Video" is what scripts/render.ts uses; the other three are previews in Studio. */}
    <Composition id="Video" {...common} defaultProps={{ brief: demoOffer }} />
    <Composition id="Offer" {...common} defaultProps={{ brief: demoOffer }} />
    <Composition id="Education" {...common} defaultProps={{ brief: demoEducation }} />
    <Composition id="ClinicalCase" {...common} defaultProps={{ brief: demoCase }} />
  </>
);
