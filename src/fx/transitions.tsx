import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { iris } from "@remotion/transitions/iris";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { flip } from "@remotion/transitions/flip";
import { video } from "../brand";
import type { TransitionName } from "./context";

/** Custom calm transition: incoming scene sharpens from a soft blur while fading in. */
const BlurFade: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress,
}) => {
  const p = presentationProgress;
  const entering = presentationDirection === "entering";
  const opacity = entering ? p : 1 - p;
  const blur = entering ? interpolate(p, [0, 1], [14, 0]) : interpolate(p, [0, 1], [0, 8]);
  const scale = entering ? interpolate(p, [0, 1], [1.04, 1]) : 1;
  return <AbsoluteFill style={{ opacity, filter: `blur(${blur}px)`, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};
const blurFade = (): TransitionPresentation<Record<string, never>> => ({ component: BlurFade, props: {} });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPresentation = TransitionPresentation<any>;

/** Presentation + timing for a named transition (null = hard cut). */
export function transitionFor(
  name: TransitionName,
  frames: number,
): { presentation: AnyPresentation; timing: ReturnType<typeof linearTiming> } | null {
  const linear = linearTiming({ durationInFrames: frames });
  const springy = springTiming({ durationInFrames: frames, config: { damping: 200 } });
  const size = { width: video.width, height: video.height };
  switch (name) {
    case "none":
      return null;
    case "fade":
      return { presentation: fade(), timing: linear };
    case "blur-fade":
      return { presentation: blurFade(), timing: linear };
    case "slide":
      return { presentation: slide({ direction: "from-bottom" }), timing: springy };
    case "push":
      return { presentation: slide({ direction: "from-right" }), timing: springy };
    case "wipe":
      return { presentation: wipe({ direction: "from-left" }), timing: linear };
    case "iris":
      return { presentation: iris(size), timing: linear };
    case "clock-wipe":
      return { presentation: clockWipe(size), timing: linear };
    case "flip":
      return { presentation: flip({ direction: "from-bottom" }), timing: springy };
  }
}
