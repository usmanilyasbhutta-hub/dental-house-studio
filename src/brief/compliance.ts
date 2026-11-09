import { clinic } from "../brand";
import { PROCEDURE_STAGES } from "./schema";
import type { Brief } from "./schema";

export type Finding = { level: "error" | "warning"; rule: string; message: string };

/** Words a medical practice should not use in advertising. Extend in CLAUDE.md first. */
export const BANNED = [
  "guarantee", "guaranteed", "painless", "pain-free", "permanent", "forever",
  "100%", "best dentist", "no.1", "number one", "cheapest", "miracle",
  "risk-free", "no risk", "cure", "instant results",
];

const PATIENT_ID = /\bDH-\d{2,}\b/i; // Dental Align patient IDs
const PHONE = /(\+?92|0)3\d{2}[-\s]?\d{7}/g;
const CLINIC_PHONE = clinic.phone.replace(/\D/g, "");
const HANDLE = /@[a-z0-9._]{3,30}/gi;

function allText(b: Brief): string[] {
  const t = [b.title, ...b.hook.lines, b.cta, b.label];
  if (b.type === "offer") t.push(b.offer.headline, b.offer.detail, b.offer.terms, b.offer.price ?? "", ...b.points);
  if (b.type === "education") t.push(b.takeaway, ...b.steps.flatMap((s) => [s.title, s.subline]));
  if (b.type === "case") t.push(b.treatment, b.timeline ?? "", ...b.notes);
  if (b.type === "procedure") t.push(...b.steps.flatMap((x) => [x.title, x.subline]), b.takeaway ?? "");
  if (b.type === "talking-head")
    t.push(b.speaker.role, ...b.chapters.flatMap((c) => [c.label, c.title]), ...b.callouts.flatMap((c) => [c.big, c.small ?? ""]));
  return t.filter(Boolean);
}

export interface ComplianceEnv {
  today: string; // YYYY-MM-DD
  fileExists: (path: string) => boolean;
}

export function checkCompliance(b: Brief, env: ComplianceEnv): Finding[] {
  const f: Finding[] = [];
  const err = (rule: string, message: string) => f.push({ level: "error", rule, message });
  const warn = (rule: string, message: string) => f.push({ level: "warning", rule, message });

  for (const text of allText(b)) {
    const lower = text.toLowerCase();
    for (const w of BANNED) {
      const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
      if (re.test(lower)) err("claims", `"${w}" is not allowed in medical advertising: "${text}"`);
    }
    if (PATIENT_ID.test(text)) err("privacy", `patient ID must never appear on screen: "${text}"`);
    for (const m of text.match(PHONE) ?? []) {
      if (m.replace(/\D/g, "").replace(/^92/, "0") !== CLINIC_PHONE)
        err("contact", `unknown phone number "${m}"; only the clinic number is allowed`);
    }
  }

  for (const text of allText(b))
    for (const h of text.match(HANDLE) ?? [])
      if (h.toLowerCase() !== clinic.instagram) err("contact", `unknown handle "${h}"; only ${clinic.instagram} is allowed`);

  if (b.hook.accent && !b.hook.lines.join(" ").toLowerCase().includes(b.hook.accent.toLowerCase()))
    warn("hook", `accent word "${b.hook.accent}" is not in the hook lines`);

  if (b.type === "offer") {
    if (b.offer.valid_until < env.today)
      (b.demo ? warn : err)("offer", `offer expired on ${b.offer.valid_until}`);
    if (!b.offer.terms.trim()) err("offer", "offer needs terms");
  }

  if (b.type === "education") {
    for (const s of b.sources) if (!s.pmid && !s.url) warn("sources", `source has no PMID/URL: "${s.citation}"`);
  }

  if (b.type === "case") {
    for (const p of [b.before, b.after])
      if (!env.fileExists(`public/${p}`)) err("assets", `missing image public/${p}`);
    if (b.demo) {
      warn("demo", "demo case: watermarked, must not be published");
    } else if (!b.consent) {
      err("consent", "clinical case needs written patient consent (consent.file)");
    } else {
      if (!env.fileExists(b.consent.file)) err("consent", `consent file not found: ${b.consent.file}`);
      if (b.consent.file.startsWith("public/")) err("consent", "consent forms must never be inside public/");
      if (!b.consent.scope.includes("social-media")) err("consent", "consent scope does not cover social media");
      if (b.identifiable && !b.consent.scope.includes("social-media"))
        err("consent", "identifiable patient needs explicit social-media consent");
    }
  }

  if (b.type === "talking-head") {
    if (!clinic.doctors.some((d) => d.startsWith(b.speaker.name)))
      err("speaker", `speaker "${b.speaker.name}" is not one of the clinic's doctors in src/brand.ts`);
    if (!b.footage.trim && !b.footage.segments) err("footage", "footage needs trim or segments");
    const segs = b.footage.segments ?? (b.footage.trim ? [b.footage.trim] : []);
    segs.forEach((g, i) => {
      if (g.end <= g.start) err("footage", `segment ${i + 1}: end must be after start`);
      if (i && g.start < segs[i - 1].end) err("footage", `segment ${i + 1} overlaps the previous one`);
    });
    for (const c of b.chapters) if ((c.at === undefined) === (c.on === undefined)) err("chapters", `chapter "${c.title}" needs exactly one of at / on`);
    if (!env.fileExists(b.footage.source)) err("footage", `source footage not found: ${b.footage.source}`);
    if (!env.fileExists(b.transcript)) err("footage", `transcript not found: ${b.transcript}`);
    if (!b.sources.length)
      warn("sources", "no sources listed: clinical-reviewer must check every spoken claim against evidence");
  }

  if (b.type === "procedure") {
    const n = PROCEDURE_STAGES[b.procedure].length;
    if (b.steps.length !== n) err("steps", `${b.procedure} animates ${n} stages (${PROCEDURE_STAGES[b.procedure].join(", ")}); give exactly ${n} steps`);
  }

  if (!b.demo && !b.review.approved_by)
    warn("review", "not yet approved by a dentist (review.approved_by); do not publish");

  return f;
}
