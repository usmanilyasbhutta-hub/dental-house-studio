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
  language: z.enum(["en", "roman-ur"]).default("en"),
  hook,
  cta: line(32).default("Book your consultation"),
  /** Small mono label in the HUD. */
  label: line(24).default("Consult first"),
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

export const brief = z.discriminatedUnion("type", [offerBrief, educationBrief, caseBrief]);

export type Brief = z.infer<typeof brief>;
export type OfferBrief = z.infer<typeof offerBrief>;
export type EducationBrief = z.infer<typeof educationBrief>;
export type CaseBrief = z.infer<typeof caseBrief>;
