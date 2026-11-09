import React, { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { Lottie, type LottieAnimationData } from "@remotion/lottie";

/**
 * Plays a Lottie animation from public/lottie/<file>.json (synced to the video frame).
 * LICENCE: only use Lottie files whose licence allows commercial use (e.g. made in-house,
 * bought, or explicitly free for commercial use). Record the source next to the file
 * (public/lottie/<file>.source.txt).
 */
export const LottieClip: React.FC<{ file: string; loop?: boolean; playbackRate?: number; style?: React.CSSProperties }> = ({ file, loop = false, playbackRate = 1, style }) => {
  const [handle] = useState(() => delayRender(`Loading Lottie ${file}`));
  const [data, setData] = useState<LottieAnimationData | null>(null);
  useEffect(() => {
    fetch(staticFile(`lottie/${file}`))
      .then((r) => r.json())
      .then((j) => {
        setData(j);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [file, handle]);
  if (!data) return null;
  return <Lottie animationData={data} loop={loop} playbackRate={playbackRate} style={style} />;
};
