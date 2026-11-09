import { clinic } from "../brand";
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

  if (!b.demo && !b.review.approved_by)
    warn("review", "not yet approved by a dentist (review.approved_by); do not publish");

  return f;
}
