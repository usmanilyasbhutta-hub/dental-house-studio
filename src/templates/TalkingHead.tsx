import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { video } from "../brand";
import { footagePaths, type TalkingHeadBrief, type Word } from "../brief/schema";
import { useTheme } from "../theme";
import { KineticHeadline } from "./shared/Headline";
import { prog } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { fitSize, headline, mono, serif } from "./shared/text";

/** Stage: where the cut-out doctor sits (footage is 1152 px wide after prep). */
const STAGE = { left: -40, top: 560, width: 1160 };
const CAPTION_TOP = 1400; // caption block sits just above the bottom safe line (1540)

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Map each callout to the time its trigger word is spoken (sequential search). */
export function calloutTimes(b: TalkingHeadBrief, words: Word[]) {
  let i = 0;
  const hits: { start: number; c: TalkingHeadBrief["callouts"][number] }[] = [];
  for (const c of b.callouts) {
    const j = words.findIndex((w, k) => k >= i && norm(w.text) === norm(c.on));
    if (j < 0) continue;
    hits.push({ start: words[j].start, c });
    i = j + 1;
  }
  return hits.map((h, k) => ({ ...h, end: Math.min(hits[k + 1]?.start ?? h.start + 2.6, h.start + 2.6) }));
}

/** Group words into caption lines: break on punctuation, pauses or length. */
export function captionChunks(words: Word[], maxChars = 24) {
  const chunks: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const len = cur.reduce((n, x) => n + x.text.length + 1, 0);
    const gap = cur.length ? w.start - cur[cur.length - 1].end : 0;
    if (cur.length && (len + w.text.length > maxChars || gap > 0.35)) {
      chunks.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.,?!]$/.test(w.text) && cur.length >= 2) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export const TalkingHead: React.FC<{ brief: TalkingHeadBrief; words?: Word[] } & QcProps> = ({ brief, words = [], showSafeZones }) => {
  const { fps } = useVideoConfig();
  const body = Math.round((brief.footage.trim.end - brief.footage.trim.start) * fps);
  const callouts = calloutTimes(brief, words);
  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones} musicVolume={brief.music_volume}>
      <Sequence durationInFrames={body}>
        {callouts.map((h, k) => (
          <Sequence key={k} from={Math.round(h.start * fps) - 3} durationInFrames={Math.max(fps, Math.round((h.end - h.start) * fps) + 3)}>
            <BigWord text={h.c.big} />
          </Sequence>
        ))}
        <Speaker src={footagePaths(brief.id).video} />
        {callouts.map((h, k) =>
          h.c.small ? (
            <Sequence key={k} from={Math.round(h.start * fps)} durationInFrames={Math.max(fps, Math.round((h.end - h.start) * fps))}>
              <SmallTag text={h.c.small} />
            </Sequence>
          ) : null,
        )}
        <Chapters brief={brief} />
        <Sequence durationInFrames={Math.round(3.4 * fps)}>
          <NameTag name={brief.speaker.name} role={brief.speaker.role} />
        </Sequence>
        <Captions words={words} />
      </Sequence>
    </Shell>
  );
};

const Speaker: React.FC<{ src: string }> = ({ src }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const outline = t.text;
  return (
    <AbsoluteFill
      style={{
        opacity: a,
        WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 74%, transparent 97%)",
        maskImage: "linear-gradient(180deg, #000 0%, #000 74%, transparent 97%)",
      }}
    >
      <OffthreadVideo
        src={staticFile(src)}
        transparent
        style={{
          position: "absolute", left: STAGE.left, top: STAGE.top, width: STAGE.width,
          filter: `drop-shadow(4px 0 0 ${outline}) drop-shadow(-4px 0 0 ${outline}) drop-shadow(0 -4px 0 ${outline}) drop-shadow(0 18px 40px rgba(0,0,0,0.45))`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Giant keyword BEHIND the doctor (reference style C). */
const BigWord: React.FC<{ text: string }> = ({ text }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = prog(frame, 0, fps * 0.35);
  const size = fitSize([text], 880, 300, 150);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 470, paddingRight: video.safe.right - video.safe.left }}>
      <div style={{ ...headline(size, t.accent), opacity: 0.92 * p, transform: `translateY(${(1 - p) * 60}px) scale(${0.94 + 0.06 * p})`, textAlign: "center", width: 920 }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** Small label in FRONT, top-right of the stage. */
const SmallTag: React.FC<{ text: string }> = ({ text }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = prog(frame, 3, fps * 0.3);
  return (
    <div style={{ position: "absolute", right: video.safe.right + 10, top: 1150, opacity: p, transform: `translateX(${(1 - p) * 30}px)` }}>
      <div style={{ ...mono(26, t.bgBottom), background: t.text, padding: "12px 20px", borderRadius: 10, letterSpacing: "0.08em" }}>{text}</div>
    </div>
  );
};

const Chapters: React.FC<{ brief: TalkingHeadBrief }> = ({ brief }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const HOOK = 2.2;
  if (sec < HOOK)
    return (
      <AbsoluteFill style={{ paddingLeft: 90, paddingTop: 270 }}>
        <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} width={850} max={150} />
      </AbsoluteFill>
    );
  const idx = Math.max(0, brief.chapters.findLastIndex((c) => sec >= Math.max(c.at, HOOK)));
  const ch = brief.chapters[idx];
  const start = Math.round(Math.max(ch.at, HOOK) * fps);
  const p = prog(frame, start, fps * 0.5);
  return (
    <AbsoluteFill style={{ paddingLeft: 90, paddingTop: 275 }}>
      <div style={{ ...mono(28, t.accent), opacity: p }}>{ch.label}</div>
      <div style={{ ...headline(fitSize([ch.title], 850, 118)), marginTop: 14, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
        {renderAccent(ch.title, ch.accent, t.accent)}
      </div>
    </AbsoluteFill>
  );
};

function renderAccent(title: string, accent: string | undefined, color: string) {
  if (!accent) return title;
  const i = title.toLowerCase().indexOf(accent.toLowerCase());
  if (i < 0) return title;
  return (
    <>
      {title.slice(0, i)}
      <span style={{ ...serif(1, color), fontSize: "1.1em", textTransform: "none" }}>{title.slice(i, i + accent.length)}</span>
      {title.slice(i + accent.length)}
    </>
  );
}

const NameTag: React.FC<{ name: string; role: string }> = ({ name, role }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = prog(frame, 6, fps * 0.4) * interpolate(frame, [fps * 3.0, fps * 3.4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 80, top: 1225, opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>
      <div style={{ background: t.text, padding: "12px 22px 14px", borderRadius: 12, borderLeft: `8px solid ${t.accent}`, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
        <div style={{ ...headline(44, t.bgBottom), textTransform: "none", letterSpacing: 0 }}>{name}</div>
        <div style={{ ...mono(20, t.bgTop), marginTop: 6, letterSpacing: "0.1em" }}>{role}</div>
      </div>
    </div>
  );
};

/** Word-by-word captions, as spoken. Active word in the accent colour. */
const Captions: React.FC<{ words: Word[] }> = ({ words }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const chunks = captionChunks(words);
  const chunk = chunks.find((c) => sec >= c[0].start - 0.05 && sec < c[c.length - 1].end + 0.25);
  if (!chunk) return null;
  return (
    <div
      style={{
        position: "absolute", left: video.safe.left + 20, right: video.safe.right + 20, top: CAPTION_TOP,
        textAlign: "center", ...headline(66), textTransform: "none", letterSpacing: "0.005em", lineHeight: 1.12,
        textShadow: "0 3px 18px rgba(0,0,0,0.65)",
      }}
    >
      {chunk.map((w, i) => {
        const active = sec >= w.start && sec < w.end + 0.05;
        const said = sec >= w.start;
        return (
          <span key={i} style={{ color: active ? t.accent : t.text, opacity: said ? 1 : 0.42, display: "inline-block", marginRight: "0.26em", transform: active ? "scale(1.06)" : undefined }}>
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
