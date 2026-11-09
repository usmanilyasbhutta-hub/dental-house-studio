import { describe, expect, it } from "vitest";
import { srtToWords } from "../scripts/prep_footage";
import { brief, type TalkingHeadBrief } from "../src/brief/schema";
import { durationSeconds } from "../src/brief/timing";
import { calloutTimes, captionChunks } from "../src/templates/TalkingHead";

const SRT = `1
00:00:01,000 --> 00:00:03,000
Mera naam Doctor Ayesha hai

2
00:00:10,000 --> 00:00:12,000
Floss daily, vitamin C tablet

3
00:00:12,000 --> 00:00:14,000
brush twice a day.`;

describe("srtToWords", () => {
  const w = srtToWords(SRT, 9.5, 14);
  it("keeps only words inside the trim, relative to trim start", () => {
    expect(w[0]).toMatchObject({ text: "Floss" });
    expect(w[0].start).toBeCloseTo(0.5);
    expect(w.find((x) => x.text === "Ayesha")).toBeUndefined();
  });
  it("words are ordered and non-overlapping", () => {
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBeGreaterThanOrEqual(w[i - 1].end - 1e-6);
  });
});

describe("captions and callouts", () => {
  const words = srtToWords(SRT, 9.5, 14);
  it("chunks break at punctuation and stay short", () => {
    const chunks = captionChunks(words);
    expect(chunks[0].map((x) => x.text).join(" ")).toBe("Floss daily,");
    for (const c of chunks) expect(c.map((x) => x.text).join(" ").length).toBeLessThanOrEqual(30);
  });
  it("callouts trigger on the spoken word, in order", () => {
    const b = { chapters: [{ at: 0 }, { at: 1.4 }], callouts: [{ on: "floss", big: "Floss" }, { on: "C", big: "Vit C" }, { on: "missing", big: "X" }, { on: "twice", big: "2×" }] } as unknown as TalkingHeadBrief;
    const hits = calloutTimes(b, words);
    expect(hits.map((h) => h.c.big)).toEqual(["Floss", "Vit C", "2×"]);
    expect(hits[0].start).toBeCloseTo(0.5);
    for (const h of hits) expect(h.end).toBeGreaterThan(h.start);
    expect(hits[0].end).toBeLessThanOrEqual(1.4); // clipped at the next chapter
  });
});

describe("talking-head brief", () => {
  it("duration = trimmed footage + end card", () => {
    const b = brief.parse({
      id: "t", type: "talking-head", title: "Test", hook: { lines: ["Hi"] },
      speaker: { name: "Dr. Ayesha Sarfraz", role: "Dentist" },
      footage: { source: "x.mp4", trim: { start: 10, end: 40 }, crop: { x: 0, y: 0, w: 10, h: 10 } },
      transcript: "x.srt", chapters: [{ at: 0, label: "01", title: "Why" }],
    });
    expect(durationSeconds(b)).toBeCloseTo(34.5);
    expect(b.theme).toBe("brand");
  });
});

describe("multi-segment cuts", () => {
  const base = {
    id: "t", type: "talking-head", title: "Test", hook: { lines: ["Hi"] },
    speaker: { name: "Dr. Ayesha Sarfraz", role: "Dentist" },
    footage: { source: "x.mp4", crop: { x: 0, y: 0, w: 10, h: 10 }, segments: [{ start: 10, end: 20 }, { start: 30, end: 32 }, { start: 40, end: 41 }] },
    transcript: "x.srt", chapters: [{ at: 0, label: "01", title: "Why" }, { on: "floss", label: "02", title: "Floss" }],
  };
  it("duration is the sum of kept segments + end card", async () => {
    const { durationSeconds } = await import("../src/brief/timing");
    expect(durationSeconds(brief.parse(base))).toBeCloseTo(13 + 4.5);
  });
  it("cut times sit at segment joins; chapters resolve from spoken words", async () => {
    const { cutTimes, chapterTimes } = await import("../src/templates/TalkingHead");
    const b = brief.parse(base) as TalkingHeadBrief;
    expect(cutTimes(b)).toEqual([10, 12]);
    const words = [{ text: "Brush", start: 1, end: 1.5 }, { text: "Floss", start: 10.2, end: 10.6 }];
    const [c1, c2] = chapterTimes(b, words);
    expect(c1).toBe(0);
    expect(c2).toBeCloseTo(10.05);
  });
  it("source-timed words are mapped through the cuts", () => {
    const srt = "1\n00:00:31,000 --> 00:00:31,800\nFloss daily.";
    const segs = [{ start: 10, end: 20 }, { start: 30, end: 32 }];
    let offset = 0;
    const mapped = segs.flatMap((g) => { const w = srtToWords(srt, g.start, g.end).map((x) => ({ ...x, start: x.start + offset })); offset += g.end - g.start; return w; });
    expect(mapped[0].start).toBeCloseTo(11); // 10 s of segment 1 + 1 s into segment 2
  });
});
