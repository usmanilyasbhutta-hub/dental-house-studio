import { segmentsOf, type Brief } from "./schema";

/** Scene lengths in seconds per template. Single source of truth for duration. */
export const scenes = {
  offer: { hook: 3, reveal: 4, point: 2, terms: 2.5, end: 4.5 },
  education: { hook: 3, step: 3.2, takeaway: 2.8, sources: 2.2, end: 4.5 },
  "talking-head": { end: 4.5 },
  case: { hook: 2.5, before: 2.5, wipe: 3, after: 2.5, notes: 3, disclaimer: 2.2, end: 4.5 },
} as const;

/** Time lost to scene overlaps when a transition is used (n scenes → n−1 overlaps). */
function overlap(b: Brief, nScenes: number) {
  return b.fx.transition === "none" ? 0 : ((nScenes - 1) * b.fx.transition_frames) / 30;
}

/** Number of body scenes per template (end card excluded). */
export function sceneCount(b: Brief): number {
  switch (b.type) {
    case "offer":
      return 3 + b.points.length;
    case "education":
      return 6;
    case "case":
      return 7;
    case "talking-head":
    case "procedure":
    case "photo-layout":
      return 1;
  }
}

export function durationSeconds(b: Brief): number {
  return rawSeconds(b) - overlap(b, sceneCount(b));
}

function rawSeconds(b: Brief): number {
  switch (b.type) {
    case "offer": {
      const s = scenes.offer;
      return s.hook + s.reveal + s.point * b.points.length + s.terms + s.end;
    }
    case "education": {
      const s = scenes.education;
      return s.hook + s.step * 3 + s.takeaway + s.sources + s.end;
    }
    case "photo-layout":
      return 1.6 + Math.max(b.annotations.length, b.layout === "annotate" ? 0 : b.photos.length) * 1.3 + (b.loupe ? 1.6 : 0) + 2.4 + scenes.offer.end;
    case "procedure":
      return 2 + b.steps.length * b.seconds_per_step + (b.takeaway ? 2.6 : 0) + scenes.offer.end; // 2 s hook
    case "talking-head":
      return segmentsOf(b).reduce((n, g) => n + g.end - g.start, 0) + scenes["talking-head"].end;
    case "case": {
      const s = scenes.case;
      return s.hook + s.before + s.wipe + s.after + s.notes + s.disclaimer + s.end;
    }
  }
}

export const sec = (s: number, fps: number) => Math.round(s * fps);
