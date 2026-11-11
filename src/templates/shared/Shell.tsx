import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import type { Brief } from "../../brief/schema";
import { ThemeContext, themes } from "../../theme";
import { FxContext } from "../../fx/context";
import { Backdrop } from "./Backdrop";
import { EndCard } from "./EndCard";
import { DemoWatermark, Hud, MinimalBug } from "./Hud";
import { SafeZones } from "./SafeZones";

export type QcProps = { showSafeZones?: boolean };

/** Common frame for every template: backdrop, HUD, end card, music, demo/safe-zone overlays. */
export const Shell: React.FC<{ brief: Brief; endSeconds: number; musicVolume?: number; chrome?: "full" | "minimal" | "minimal-light" | "none"; end?: React.ReactNode; backdrop?: boolean; children: React.ReactNode } & QcProps> = ({
  brief,
  endSeconds,
  showSafeZones,
  musicVolume = 0.9,
  chrome = "full",
  end,
  backdrop = true,
  children,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const endFrames = Math.round(endSeconds * fps);
  const bodyFrames = durationInFrames - endFrames;
  const theme = themes[brief.theme];
  return (
    <ThemeContext.Provider value={theme}>
    <FxContext.Provider value={{ transition: brief.fx.transition, transitionFrames: brief.fx.transition_frames, sfx: brief.fx.sfx }}>
    <AbsoluteFill style={{ color: theme.text }}>
      <Sequence durationInFrames={bodyFrames}>
        {backdrop ? <Backdrop broll={brief.broll[0]} /> : null}
        {children}
        {chrome === "full" ? <Hud label={brief.label} total={bodyFrames} /> : chrome === "none" ? null : <MinimalBug light={chrome === "minimal-light"} />}
      </Sequence>
      <Sequence from={bodyFrames}>
        {end ?? <EndCard cta={brief.cta} note={brief.disclaimer} />}
      </Sequence>
      {brief.music ? (
        <Audio
          src={staticFile(brief.music)}
          volume={(f) => interpolate(f, [0, 15, durationInFrames - 30, durationInFrames], [0, musicVolume, musicVolume, 0], { extrapolateRight: "clamp" })}
        />
      ) : null}
      {brief.demo ? <DemoWatermark /> : null}
      {showSafeZones ? <SafeZones /> : null}
    </AbsoluteFill>
    </FxContext.Provider>
    </ThemeContext.Provider>
  );
};
