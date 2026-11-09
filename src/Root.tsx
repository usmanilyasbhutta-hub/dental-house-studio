import React from "react";
import { Composition } from "remotion";
import { video } from "./brand";
import { staticFile } from "remotion";
import { brief as briefSchema, footagePaths, type Word } from "./brief/schema";
import { durationSeconds } from "./brief/timing";
import { demoCase, demoEducation, demoOffer } from "./demo-briefs";
import { loadBrandFonts } from "./templates/shared/fonts";
import { Video, type VideoProps } from "./Video";
import { EffectsGallery, galleryFrames } from "./fx/Gallery";
import { photoSizes } from "./templates/PhotoLayout";

loadBrandFonts();

const calc = async ({ props }: { props: VideoProps }) => {
  const b = briefSchema.parse(props.brief); // fail loudly on bad props
  let words: Word[] | undefined = props.words;
  if (b.type === "talking-head" && !words) {
    const res = await fetch(staticFile(footagePaths(b.id).words));
    if (!res.ok) throw new Error(`Missing ${footagePaths(b.id).words}: run npm run prep -- <brief> first`);
    words = (await res.json()) as Word[];
  }
  const sizes = b.type === "photo-layout" ? (props.sizes ?? (await photoSizes(b.photos.map((p) => p.src)))) : props.sizes;
  return { durationInFrames: Math.round(durationSeconds(b) * video.fps), props: { ...props, brief: b, words, sizes } };
};

const common = { component: Video, fps: video.fps, width: video.width, height: video.height, durationInFrames: 1, calculateMetadata: calc };

export const Root: React.FC = () => (
  <>
    {/* "Video" is what scripts/render.ts uses; the other three are previews in Studio. */}
    <Composition id="Video" {...common} defaultProps={{ brief: demoOffer }} />
    <Composition id="Offer" {...common} defaultProps={{ brief: demoOffer }} />
    <Composition id="Education" {...common} defaultProps={{ brief: demoEducation }} />
    <Composition id="ClinicalCase" {...common} defaultProps={{ brief: demoCase }} />
    <Composition id="EffectsGallery" component={EffectsGallery} fps={video.fps} width={video.width} height={video.height} durationInFrames={galleryFrames} />
  </>
);
