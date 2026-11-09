import type { Brief } from "./schema";

/** Scene lengths in seconds per template. Single source of truth for duration. */
export const scenes = {
  offer: { hook: 3, reveal: 4, point: 2, terms: 2.5, end: 4.5 },
  education: { hook: 3, step: 3.2, takeaway: 2.8, sources: 2.2, end: 4.5 },
  "talking-head": { end: 4.5 },
  case: { hook: 2.5, before: 2.5, wipe: 3, after: 2.5, notes: 3, disclaimer: 2.2, end: 4.5 },
} as const;

export function durationSeconds(b: Brief): number {
  switch (b.type) {
    case "offer": {
      const s = scenes.offer;
      return s.hook + s.reveal + s.point * b.points.length + s.terms + s.end;
    }
    case "education": {
      const s = scenes.education;
      return s.hook + s.step * 3 + s.takeaway + s.sources + s.end;
    }
    case "talking-head":
      return b.footage.trim.end - b.footage.trim.start + scenes["talking-head"].end;
    case "case": {
      const s = scenes.case;
      return s.hook + s.before + s.wipe + s.after + s.notes + s.disclaimer + s.end;
    }
  }
}

export const sec = (s: number, fps: number) => Math.round(s * fps);
