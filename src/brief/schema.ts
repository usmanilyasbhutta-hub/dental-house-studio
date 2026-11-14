import { z } from "zod";
import { TRANSITIONS } from "../fx/context";
import { DOODLES } from "../fx/doodles";
import { MEDIA } from "../fx/media";
import { LOOKS } from "../fx/looks";

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
  /** Effects (see docs/effects.md). Calm defaults: soft fade between scenes, no sound effects. */
  fx: z
    .object({
      transition: z.enum(TRANSITIONS).default("fade"),
      transition_frames: z.number().int().min(4).max(24).default(10),
      sfx: z.enum(["none", "subtle"]).default("none"),
      /** Whole-video look (docs/effects.md): crt, thermal, matrix, pixel, synthwave, mono. Never on clinical material. */
      look: z.enum(LOOKS).default("none"),
    })
    .default({}),
  /** Short note printed on the end card, e.g. "General information, not a diagnosis." */
  disclaimer: z.string().max(110).optional(),
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
    /** Seconds in the source to keep (one range)… */
    trim: z.object({ start: z.number().min(0), end: z.number().positive() }).optional(),
    /** …or several ranges, joined in order with jump cuts (cut points should sit in pauses; verify by re-transcribing). */
    segments: z.array(z.object({ start: z.number().min(0), end: z.number().positive() })).min(1).optional(),
    /** Source-pixel rectangle that contains the speaker (drops burned-in text). */
    crop: z.object({ x: z.number().int().min(0), y: z.number().int().min(0), w: z.number().int().positive(), h: z.number().int().positive() }),
    /** Colour correction applied before compositing. */
    grade: z.enum(["none", "neutral-skin"]).default("neutral-skin"),
    /** Source-pixel boxes where burned-in overlays (e.g. an old handle watermark) appear; their text strokes are painted out. */
    remove: z.array(z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int() })).default([]),
    /** Cut the speaker out of the background (needs scripts/prep_footage.py). */
    cutout: z.boolean().default(true),
  }),
  /** Transcript SRT; converted to word timings by prep_footage. */
  transcript: z.string(),
  /** "source": SRT of the raw recording (times are mapped through the cuts). "edit": SRT of the cut audio (most accurate). */
  transcript_timebase: z.enum(["source", "edit"]).default("source"),
  chapters: z
    .array(z.object({ at: z.number().min(0).optional(), on: z.string().optional(), label: line(20), title: line(22), accent: z.string().optional() }))
    .min(1)
    .max(4),
  /** Giant keyword behind the doctor, triggered when `on` is spoken. */
  callouts: z
    .array(
      z.object({
        on: z.string().min(1),
        big: line(12),
        small: line(28).optional(),
        /** Extra emphasis on this keyword. */
        fx: z.enum(["none", "sparkle", "shine", "glow", "punch"]).default("none"),
      }),
    )
    .max(14)
    .default([]),
  music_volume: z.number().min(0).max(1).default(0.12),
  sources: z
    .array(z.object({ citation: z.string().min(5), pmid: z.string().optional(), url: z.string().url().optional() }))
    .default([]),
});

/** Stages each 3D procedure animates, in order. Briefs must give one step per stage. */
export const PROCEDURE_STAGES = {
  implant: ["gap", "implant", "abutment", "crown"],
  crown: ["damaged", "prepare", "crown"],
  /** Composite restoration of carious anterior teeth (mesial, 11/21): generic products only. */
  composite: ["decay", "prep", "etch", "bond", "layer", "cure", "polish"],
} as const;

/** 3D procedure explainer (illustration): procedural models, one step card per stage. */
export const procedureBrief = base.extend({
  type: z.literal("procedure"),
  procedure: z.enum(["implant", "crown", "composite"]),
  steps: z.array(z.object({ title: line(26), subline: line(56) })).min(3).max(7),
  seconds_per_step: z.number().min(2).max(6).default(3.4),
  takeaway: line(60).optional(),
});
export type ProcedureBrief = z.infer<typeof procedureBrief>;

const pct = z.number().min(0).max(100);

/** Photo layouts: annotate one photo, or arrange 2–4 photos (education, cases, clinic, products). */
export const photoLayoutBrief = base.extend({
  type: z.literal("photo-layout"),
  layout: z.enum(["annotate", "grid", "split"]),
  photos: z.array(z.object({ src: publicAsset, label: line(24).optional() })).min(1).max(4),
  /** annotate: points in % of the photo (0–100), revealed in order. */
  annotations: z
    .array(
      z.object({
        x: pct,
        y: pct,
        label: line(28),
        kind: z.enum(["pin", "circle", "arrow"]).default("pin"),
        /** Label side relative to the point. */
        side: z.enum(["left", "right", "above", "below"]).default("right"),
      }),
    )
    .max(6)
    .default([]),
  /** Magnifier on one spot of the (first) photo. */
  loupe: z.object({ x: pct, y: pct, zoom: z.number().min(1.5).max(4).default(2.4) }).optional(),
  caption: line(70).optional(),
  /** Patient photo? Then consent rules apply exactly as for clinical cases. */
  clinical: z.boolean().default(false),
  consent: z
    .object({ file: z.string(), signed_on: isoDate, scope: z.array(z.enum(["social-media", "website", "ads", "print"])).min(1) })
    .optional(),
});
export type PhotoLayoutBrief = z.infer<typeof photoLayoutBrief>;

/** Anatomy-map layout (reference style "I"): full-frame photo, traced outlines, hatch/colour zones, edge labels with leaders. */
export const mapRegion = z.object({
  /** Outline points: photo pixels (units: px) or % of the photo (units: percent). Smoothed into a curve. */
  points: z.array(z.tuple([z.number(), z.number()])).min(2),
  closed: z.boolean().default(true),
  /** outline = traced line; hatch = fine grid inside; fill = translucent colour zone; ridge = tick marks along the line */
  style: z.enum(["outline", "hatch", "fill", "ridge"]).default("outline"),
  /** Palette slot 1–6 for fills (brand-harmonised map colours). */
  color: z.number().int().min(1).max(6).optional(),
  label: z.object({ bold: line(20), text: line(26).optional() }).optional(),
  /** Where the label sits; a curved leader runs from it to the outline. */
  anchor: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).default("top-left"),
});
export const anatomyMapBrief = base.extend({
  type: z.literal("anatomy-map"),
  scenes: z
    .array(
      z.object({
        photo: publicAsset,
        units: z.enum(["px", "percent"]).default("percent"),
        /**
         * Optional uniform zoom onto an area of interest (photo px). Never warps or edits the photo; the zoomed photo is
         * centred on this box and the rest of the frame shows the photo / blurred fill. Before/after chapters must share it.
         */
        focus: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }).optional(),
        /** Small elegant title: `bold` is the emphasised word(s) inside `text`. */
        title: z.object({ text: line(48), bold: z.string().optional() }),
        regions: z.array(mapRegion).min(1).max(8),
      }),
    )
    .min(1)
    .max(3),
  seconds_per_region: z.number().min(1.2).max(4).default(2),
  clinical: z.boolean().default(false),
  consent: z
    .object({ file: z.string(), signed_on: isoDate, scope: z.array(z.enum(["social-media", "website", "ads", "print"])).min(1) })
    .optional(),
});
export type AnatomyMapBrief = z.infer<typeof anatomyMapBrief>;

const gridPoint = z.tuple([z.number().int().min(0), z.number().int().min(0)]);

/**
 * Map route (reference: "map-route" reel): a route drawn through an ILLUSTRATIVE 3D clay city, chase camera,
 * pull-back to an overview, pin drop at the destination. Not a real map: streets are only labels the brief gives.
 * Route points are grid intersections [col, row]; consecutive points must share a col or a row (roads are a grid).
 */
export const mapRouteBrief = base.extend({
    type: z.literal("map-route"),
    /** clay = white city, blue route (as the reference); brand = slate city, bronze route. */
    palette: z.enum(["clay", "brand"]).default("clay"),
    seed: z.number().int().min(1).default(7),
    grid: z.object({ cols: z.number().int().min(6).max(24).default(14), rows: z.number().int().min(8).max(30).default(20) }).default({}),
    river: z.boolean().default(true),
    route: z.array(gridPoint).min(2).max(12),
    start: z.object({ label: line(22) }).optional(),
    /** Defaults to the clinic name (src/brand.ts). */
    destination: z.object({ label: line(22).optional() }).default({}),
    /** Street labels at grid intersections (text only: do not invent real street names; use ones the owner gives). */
    streets: z.array(z.object({ at: gridPoint, text: line(22) })).max(4).default([]),
    /** Small chip at the top. Keep it honest: the city is drawn, not mapped. */
    chip: line(44).default("Illustrative map · not to scale"),
    /** Print the clinic address (from src/brand.ts) under the headline at the end. */
    show_address: z.boolean().default(true),
    /** How long the route takes to draw. */
    seconds: z.number().min(4).max(14).default(7),
  });
export type MapRouteBrief = z.infer<typeof mapRouteBrief>;

/**
 * Blueprint (reference: "Blueprint" style reel): white line drawing builds on blueprint paper, dimension lines,
 * typed note, title block. Subjects are drawn in code (src/fx/blueprint-subjects.ts). Illustration, not to scale.
 */
export const blueprintBrief = base.extend({
  type: z.literal("blueprint"),
  subject: z.enum(["implant", "tooth"]),
  /** Title block text; defaults to the subject's figure title. */
  figure: line(32).optional(),
  /** Up to 3 short lines typed into the NOTE box. */
  note: z.array(line(30)).max(3).default([]),
  /** Implant only: dimension texts, or null to hide them. Typical sizes; say in the note that sizes vary per patient. */
  dimensions: z.object({ length: line(12), diameter: line(12) }).nullable().default({ length: "L 10 mm", diameter: "Ø 4.0 mm" }),
  labels: z.boolean().default(true),
  /** How long the drawing takes (the end card follows). */
  seconds: z.number().min(8).max(20).default(12),
});
export type BlueprintBrief = z.infer<typeof blueprintBrief>;

/**
 * Receipt (reference: "/receipt" reel): a printer prints a receipt line by line, it tears off, camera pushes in on the total.
 * Prices are clinic facts: only the owner's real, current prices (set prices_confirmed_on), or non-price values ("Included").
 */
export const receiptBrief = base.extend({
  type: z.literal("receipt"),
  items: z.array(z.object({ text: line(24), value: line(12) })).min(2).max(7),
  total: z.object({ label: line(14).default("Total"), value: line(14) }),
  /** Small lines under the items, e.g. "Check-up visit" / "Prices as of Nov 2026". */
  footer: z.array(line(34)).max(2).default([]),
  /** Date the owner confirmed the prices on this receipt (required when values contain numbers). */
  prices_confirmed_on: isoDate.optional(),
  /** Seconds to hold on the total before the end card. */
  hold: z.number().min(1.5).max(5).default(2.6),
});
export type ReceiptBrief = z.infer<typeof receiptBrief>;

/**
 * Hand-drawn explainer (reference: "Hand-Drawn Explainer" reel): doodles draw themselves stroke by stroke on paper,
 * colour fills in, a handwritten caption highlights one *word*. The title is the hook (handwritten, underlined).
 */
export const sketchBrief = base.extend({
  type: z.literal("sketch"),
  /** Drawing medium (docs/style-recipes.md): pencil, watercolour, chalkboard, crayon, ink, collage. */
  style: z.enum(MEDIA).default("pencil"),
  subheading: line(60).optional(),
  scenes: z
    .array(
      z.object({
        /** 1–3 doodles; x/y = centre in % of the drawing area, size in px, rotate in degrees. */
        draw: z
          .array(
            z.object({
              doodle: z.enum(DOODLES as [string, ...string[]]),
              x: pct.default(50),
              y: pct.default(50),
              size: z.number().min(120).max(700).default(420),
              rotate: z.number().min(-180).max(180).default(0),
            }),
          )
          .min(1)
          .max(3),
        /** Small handwritten sign on the drawing (like "LATER"). */
        tag: z.object({ text: line(16), x: pct, y: pct }).optional(),
        /** Caption; wrap ONE word in *stars* to highlight it. */
        caption: line(90),
      }),
    )
    .min(1)
    .max(6),
  seconds_per_scene: z.number().min(3).max(7).default(4.5),
  /** Small label bottom-left, e.g. "Field notes · bleeding gums". */
  footer: line(40).optional(),
  /** Education claims need sources (PubMed). */
  sources: z.array(z.string()).default([]),
});
export type SketchBrief = z.infer<typeof sketchBrief>;

/**
 * Diagram explainer ("visual codes"): one idea laid out as a timeline, roadmap, flowchart, cycle, layers, iceberg,
 * tree, decision matrix or infographic. Items reveal one by one; optional doodle icons. Title = hook.
 */
export const DIAGRAM_LAYOUTS = ["timeline", "roadmap", "flowchart", "cycle", "layers", "iceberg", "tree", "matrix", "infographic"] as const;
export const diagramBrief = base.extend({
  type: z.literal("diagram"),
  layout: z.enum(DIAGRAM_LAYOUTS),
  subheading: line(60).optional(),
  items: z
    .array(
      z.object({
        label: line(26),
        text: line(70).optional(),
        /** timeline date / roadmap step / infographic big number ("2×", "6 mo"). */
        tag: line(14).optional(),
        icon: z.enum(DOODLES as [string, ...string[]]).optional(),
        /** tree: index of the parent item (root has none). */
        parent: z.number().int().min(0).optional(),
        /** flowchart: a question (diamond). `no` = the side branch's outcome; "yes" continues down. */
        question: z.boolean().default(false),
        no: line(26).optional(),
      }),
    )
    .min(2)
    .max(8),
  /** iceberg: how many items sit above the waterline. */
  above: z.number().int().min(1).max(3).default(1),
  /** matrix: column headers; each item's `text` holds the cells separated by " | " (use ✓ / ✗ / short words). */
  columns: z.array(line(14)).min(2).max(4).optional(),
  seconds_per_item: z.number().min(0.8).max(4).default(1.5),
  hold: z.number().min(1.5).max(5).default(2.6),
  footer: line(40).optional(),
  sources: z.array(z.string()).default([]),
});
export type DiagramBrief = z.infer<typeof diagramBrief>;

export const brief = z.discriminatedUnion("type", [offerBrief, educationBrief, caseBrief, talkingHeadBrief, procedureBrief, photoLayoutBrief, anatomyMapBrief, mapRouteBrief, blueprintBrief, receiptBrief, sketchBrief, diagramBrief]);
export type TalkingHeadBrief = z.infer<typeof talkingHeadBrief>;

/** Kept source ranges, in order. */
export function segmentsOf(b: TalkingHeadBrief): { start: number; end: number }[] {
  if (b.footage.segments) return b.footage.segments;
  if (b.footage.trim) return [b.footage.trim];
  throw new Error("footage needs trim or segments");
}

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
