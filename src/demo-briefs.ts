// Studio defaults (mirrors briefs/examples/*.yaml; tests keep them in sync).
import type { CaseBrief, EducationBrief, OfferBrief } from "./brief/schema";

const common = { language: "en" as const, broll: [] as string[], review: {}, demo: true };

export const demoOffer: OfferBrief = {
  ...common,
  id: "offer-implant-consult",
  type: "offer",
  title: "Implant consultation, example offer",
  tone: "contemporary",
  hook: { lines: ["Missing a tooth?", "Let's talk", "about implants"], accent: "implants" },
  offer: {
    headline: "Implant consultation",
    price: "Free",
    detail: "Includes an OPG X-ray and a written treatment plan.",
    valid_until: "2026-12-31",
    terms: "Consultation and OPG only. Treatment priced after examination. One per patient.",
  },
  points: ["Exam by an implant dentist", "OPG X-ray included", "Clear written plan & cost"],
  cta: "Book your consultation",
  label: "Consult first",
  music: "audio/pad-calm.mp3",
};

export const demoEducation: EducationBrief = {
  ...common,
  id: "education-bleeding-gums",
  type: "education",
  title: "Bleeding gums, what they mean",
  tone: "calm",
  hook: { lines: ["Gums bleed", "when you brush?", "Don't ignore it."], accent: "ignore" },
  steps: [
    { title: "Bleeding is a signal", subline: "Gums that bleed when you brush are usually inflamed." },
    { title: "It is very common", subline: "Severe gum disease affects about 1 in 10 adults." },
    { title: "Brush the gumline", subline: "Twice daily. Powered brushes remove a bit more plaque." },
  ],
  takeaway: "Healthy gums don't bleed. Get them checked early.",
  sources: [
    { citation: "Kassebaum NJ et al. Global burden of severe periodontitis 1990-2010. J Dent Res 2014;93(11):1045-53.", pmid: "25261053" },
    { citation: "Yaacob M et al. Powered versus manual toothbrushing for oral health. Cochrane Database Syst Rev 2014;(6):CD002281.", pmid: "24934383" },
  ],
  cta: "Book a gum check-up",
  label: "Healthy gums",
  music: "audio/pad-calm.mp3",
};

export const demoCase: CaseBrief = {
  ...common,
  id: "case-demo-spacing",
  type: "case",
  title: "Closing a front-tooth gap, demo",
  tone: "calm",
  case_id: "demo-case",
  treatment: "Composite bonding",
  hook: { lines: ["One visit.", "One confident", "smile."], accent: "confident" },
  before: "cases/demo-case/before.png",
  after: "cases/demo-case/after.png",
  notes: ["Shade matched to natural teeth", "Gap closed with composite", "No drilling of healthy enamel"],
  timeline: "Completed in a single visit",
  identifiable: false,
  cta: "Ask about bonding",
  label: "Real results",
  music: "audio/pad-calm.mp3",
};
