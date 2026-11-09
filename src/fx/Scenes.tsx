import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { useFx } from "./context";
import { transitionFor } from "./transitions";

export type SceneItem = { seconds: number; node: React.ReactNode };

/**
 * Plays scenes back to back. With a transition, neighbouring scenes overlap by
 * `transitionFrames`; total length = sum − (n − 1) × overlap (timing.ts accounts for it).
 */
export const Scenes: React.FC<{ items: SceneItem[] }> = ({ items }) => {
  const { fps } = useVideoConfig();
  const fx = useFx();
  const tr = transitionFor(fx.transition, fx.transitionFrames);
  if (!tr) {
    let from = 0;
    return (
      <>
        {items.map((it, i) => {
          const d = Math.round(it.seconds * fps);
          const el = (
            <Sequence key={i} from={from} durationInFrames={d}>
              {it.node}
            </Sequence>
          );
          from += d;
          return el;
        })}
      </>
    );
  }
  return (
    <TransitionSeries>
      {items.flatMap((it, i) => [
        ...(i ? [<TransitionSeries.Transition key={`t${i}`} presentation={tr.presentation} timing={tr.timing} />] : []),
        <TransitionSeries.Sequence key={`s${i}`} durationInFrames={Math.round(it.seconds * fps)}>
          {it.node}
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
  );
};

/** Legacy edge fade (only when transitions are off, so scenes don't fade twice). */
export function useEdgeFade() {
  return useFx().transition === "none";
}
