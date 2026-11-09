import React from "react";
import type { Brief } from "./brief/schema";
import { ClinicalCase } from "./templates/ClinicalCase";
import { Education } from "./templates/Education";
import { Offer } from "./templates/Offer";
import type { QcProps } from "./templates/shared/Shell";

export type VideoProps = { brief: Brief } & QcProps;

/** One entry composition; the brief's `type` picks the template. */
export const Video: React.FC<VideoProps> = ({ brief, showSafeZones }) => {
  switch (brief.type) {
    case "offer":
      return <Offer brief={brief} showSafeZones={showSafeZones} />;
    case "education":
      return <Education brief={brief} showSafeZones={showSafeZones} />;
    case "case":
      return <ClinicalCase brief={brief} showSafeZones={showSafeZones} />;
  }
};
