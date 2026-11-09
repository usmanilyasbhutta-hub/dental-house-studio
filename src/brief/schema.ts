import { z } from "zod";

// ---- shared ---------------------------------------------------------------
const line = (max: number) => z.string().min(1).max(max);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
  .or(z.date().transform((d) => d.toISOString().slice(0, 10)));

/** A file inside public/ (Remotion can only load assets from there). */
const publicAsset = z
  .string()
  .regex(/^[\w\-./]+\.(jpg|jpeg|png|webp|mp4|mov|wav|mp3)$/i, "path inside public/, e.g. cases/x/before.jpg")
  .refine((p) => !p.startsWith("/") && !p.includes(".."), "relative path inside public/");

const hook = z.object({
  /** 1-4 short lines, shown as a kinetic headline. */
  lines: z.array(line(22)).min(1).max(4),
  /** One emotional word shown in serif italic (must appear in `lines`). */
  accent: z.string().optional(),
});

const base = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "lowercase-slug"),
  title: line(80),
  /**
   * Caption language. Default "as-spoken": captions follow whatever is spoken (English, Urdu or mixed),
   * word for word. Owner decision, Nov 2026.
   */
  language: z.enum(["as-spoken", "en", "ur", "roman-ur"]).default("as-spoken"),
  hook,
  cta: line(32).default("Book your consultation"),
  /** Small mono label in the HUD. */
  label: line(24).default("Consult first"),
  /** Visual family: brand = slate/bronze (default), editorial = cream/deep green for doctor-led education. */
  theme: z.enum(["brand", "editorial"]).default("brand"),
  /** Tone controls motion: calm = no glitch cuts. */
  tone: z.enum(["calm", "contemporary"]).default("calm"),
  music: publicAsset.optional(),
  /** Optional clinic b-roll photos/videos (inside public/). */
  broll: z.array(publicAsset).max(6).default([]),
  /** Demo briefs are watermarked and may skip consent; never publish them. */
  demo: z.boolean().default(false),
  review: z
    .object({
      approved_by: z.string().optional(),
      approved_on: isoDate.optional(),
    })
    .default({}),
});

// ---- per type --------------------------------------------------------------
export const offerBrief = base.extend({
  type: z.literal("offer"),
  offer: z.object({
    headline: line(28),
    detail: line(60),
    price: line(24).optional(),
    valid_until: isoDate,
    terms: line(90),
  }),
  points: z.array(line(34)).min(1).max(3),
});

export const educationBrief = base.extend({
  type: z.literal("education"),
  steps: z
    .array(z.object({ title: line(26), subline: line(56) }))
    .length(3),
  takeaway: line(60),
  sources: z
    .array(z.object({ citation: z.string().min(5), pmid: z.string().optional(), url: z.string().url().optional() }))
    .min(1, "education videos need at least one source"),
});

export const caseBrief = base.extend({
  type: z.literal("case"),
  case_id: z.string().regex(/^[a-z0-9-]+$/),
  treatment: line(40),
  before: publicAsset,
  after: publicAsset,
  /** What was done, 1-3 short factual lines. */
  notes: z.array(line(40)).min(1).max(3),
  /** Visits / duration, factual. */
  timeline: line(40).optional(),
  identifiable: z.boolean().default(false),
  consent: z
    .object({
      /** Kept OUTSIDE git, e.g. assets/cases/<case_id>/consent.pdf */
      file: z.string(),
      signed_on: isoDate,
      scope: z.array(z.enum(["social-media", "website", "ads", "print"])).min(1),
    })
    .optional(),
});

/** One spoken word with timing (seconds, relative to the trimmed footage). */
export const word = z.object({ text: z.string(), start: z.number(), end: z.number() });
export type Word = z.infer<typeof word>;

/**
 * Doctor-led talking head (style profile §5.1): cut-out doctor over the theme backdrop,
 * word-by-word captions as spoken, chapter titles, giant keyword callouts behind the doctor.
 */
export const talkingHeadBrief = base.extend({
  type: z.literal("talking-head"),
  speaker: z.object({ name: z.string(), role: line(40) }),
  footage: z.object({
    /** Raw recording (any folder; not bundled). */
    source: z.string(),
    /** Seconds in the source to keep. */
    trim: z.object({ start: z.number().min(0), end: z.number().positive() }),
    /** Source-pixel rectangle that contains the speaker (drops burned-in text). */
    crop: z.object({ x: z.number().int().min(0), y: z.number().int().min(0), w: z.number().int().positive(), h: z.number().int().positive() }),
    /** Colour correction applied before compositing. */
    grade: z.enum(["none", "neutral-skin"]).default("neutral-skin"),
    /** Source-pixel boxes where burned-in overlays (e.g. an old handle watermark) appear; their text strokes are painted out. */
    remove: z.array(z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int() })).default([]),
    /** Cut the speaker out of the background (needs scripts/prep_footage.py). */
    cutout: z.boolean().default(true),
  }),
  /** Transcript as SRT with times in SOURCE seconds; converted to word timings by prep_footage. */
  transcript: z.string(),
  chapters: z
    .array(z.object({ at: z.number().min(0), label: line(20), title: line(22), accent: z.string().optional() }))
    .min(1)
    .max(4),
  /** Giant keyword behind the doctor, triggered when `on` is spoken. */
  callouts: z
    .array(z.object({ on: z.string().min(1), big: line(12), small: line(28).optional() }))
    .max(14)
    .default([]),
  music_volume: z.number().min(0).max(1).default(0.12),
  sources: z
    .array(z.object({ citation: z.string().min(5), pmid: z.string().optional(), url: z.string().url().optional() }))
    .default([]),
});

export const brief = z.discriminatedUnion("type", [offerBrief, educationBrief, caseBrief, talkingHeadBrief]);
export type TalkingHeadBrief = z.infer<typeof talkingHeadBrief>;

/** Where prep_footage writes its outputs for a talking-head brief (inside public/). */
export const footagePaths = (id: string) => ({
  /** VP9 WebM with alpha (cut-out) or plain, including the speech audio. */
  video: `footage/${id}.webm`,
  words: `footage/${id}.words.json`,
});

export type Brief = z.infer<typeof brief>;
export type OfferBrief = z.infer<typeof offerBrief>;
export type EducationBrief = z.infer<typeof educationBrief>;
export type CaseBrief = z.infer<typeof caseBrief>;
