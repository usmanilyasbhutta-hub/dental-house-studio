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

/** Technical dental phrases that contain a banned word but make no claim (e.g. light-curing composite). */
export const ALLOWED_PHRASES = ["light cure", "light-cure", "light curing", "light-curing", "curing light", "cured layer"];

/** Result/speed promises like "8 shades whiter" or "white in 60 minutes" (owner rule, Nov 2026). */
const SPEED_CLAIM = /\b\d+\s*(\+\s*)?shades?\b|\b(in|within)\s+\d+\s*(min|mins|minutes|hour|hours|ghante|minute)\b/i;
const PATIENT_ID = /\bDH-\d{2,}\b/i; // Dental Align patient IDs
const PHONE = /(\+?92|0)3\d{2}[-\s]?\d{7}/g;
const CLINIC_PHONE = clinic.phone.replace(/\D/g, "");
const HANDLE = /@[a-z0-9._]{3,30}/gi;

function allText(b: Brief): string[] {
  const t = [b.title, ...b.hook.lines, b.cta, b.label];
  if (b.type === "offer") t.push(b.offer.headline, b.offer.detail, b.offer.terms, b.offer.price ?? "", ...b.points);
  if (b.type === "education") t.push(b.takeaway, ...b.steps.flatMap((s) => [s.title, s.subline]));
  if (b.type === "case") t.push(b.treatment, b.timeline ?? "", ...b.notes);
  if (b.type === "anatomy-map")
    t.push(...b.scenes.flatMap((sc) => [sc.title.text, ...sc.regions.flatMap((r) => (r.label ? [r.label.bold, r.label.text ?? ""] : []))]));
  if (b.type === "photo-layout") t.push(...b.annotations.map((a) => a.label), ...b.photos.map((p) => p.label ?? ""), b.caption ?? "");
  if (b.type === "sketch") t.push(b.subheading ?? "", b.footer ?? "", ...b.scenes.flatMap((sc) => [sc.caption.replace(/\*/g, ""), sc.tag?.text ?? ""]));
  if (b.type === "receipt") t.push(...b.items.flatMap((i) => [i.text, i.value]), b.total.label, b.total.value, ...b.footer);
  if (b.type === "blueprint") t.push(b.figure ?? "", ...b.note, b.dimensions?.length ?? "", b.dimensions?.diameter ?? "");
  if (b.type === "map-route")
    t.push(b.chip, b.start?.label ?? "", b.destination.label ?? "", ...b.streets.map((x) => x.text));
  if (b.type === "promo")
    t.push(b.kicker ?? "", b.proof.eyebrow, b.proof.title, b.proof.note, b.proof.labels.before, b.proof.labels.after,
      b.value.eyebrow ?? "", b.value.title, ...b.value.points.flatMap((p) => [p.title, p.sub ?? ""]),
      b.price.eyebrow, b.price.service, b.price.now, b.price.was ?? "", b.price.save ?? "", b.price.extra ?? "",
      b.visit?.eyebrow ?? "", b.visit?.title ?? "", b.end.eyebrow ?? "", b.end.disclaimer ?? "");
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
    let lower = text.toLowerCase();
    for (const ok of ALLOWED_PHRASES) lower = lower.split(ok).join(" ");
    for (const w of BANNED) {
      const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
      if (re.test(lower)) err("claims", `"${w}" is not allowed in medical advertising: "${text}"`);
    }
    if (SPEED_CLAIM.test(text)) err("claims", `no "X shades / in Y minutes" result claims (owner rule): "${text}"`);
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

  if (b.type === "sketch") {
    b.scenes.forEach((sc, i) => {
      const stars = (sc.caption.match(/\*/g) ?? []).length;
      if (stars !== 0 && stars !== 2) err("caption", `scene ${i + 1}: highlight exactly one word with *stars* ("${sc.caption}")`);
    });
    if (!b.sources.length && !b.demo) warn("sources", "education captions: add PubMed sources so clinical-reviewer can check each claim");
  }

  if (b.type === "receipt") {
    const priced = [...b.items.map((i) => i.value), b.total.value].some((v) => /\d/.test(v));
    if (priced && !b.prices_confirmed_on) {
      const msg = "prices are clinic facts: use the owner's current prices and set prices_confirmed_on (or use values like \"Included\")";
      if (b.demo) warn("prices", msg);
      else err("prices", msg);
    }
    if (b.prices_confirmed_on) {
      const age = (Date.parse(env.today) - Date.parse(b.prices_confirmed_on)) / 86400000;
      if (age > 90) warn("prices", `prices were confirmed ${Math.round(age)} days ago: check they are still current`);
    }
  }

  if (b.type === "blueprint") {
    if (b.subject === "implant" && b.dimensions && !b.note.some((n) => /vary|varies|per patient|typical/i.test(n)))
      warn("dimensions", "implant sizes are chosen per patient: add a note line such as \"Sizes vary per patient\"");
    if (b.subject !== "implant" && b.dimensions && b.dimensions.length !== "L 10 mm")
      warn("dimensions", "dimensions are only drawn for the implant subject");
  }

  if (b.type === "map-route") {
    const { cols, rows } = b.grid;
    const off = ([i, j]: [number, number]) => i > cols || j > rows;
    b.route.forEach((p, k) => {
      if (off(p)) err("route", `route point ${k + 1} [${p}] is outside the ${cols}×${rows} grid`);
      if (k > 0) {
        const q = b.route[k - 1];
        if (q[0] !== p[0] && q[1] !== p[1]) err("route", `route point ${k + 1} must share a col or row with point ${k} (roads are a grid)`);
        if (q[0] === p[0] && q[1] === p[1]) err("route", `route point ${k + 1} repeats point ${k}`);
      }
    });
    for (const s of b.streets) if (off(s.at)) err("route", `street label "${s.text}" is outside the grid`);
    if (!/illustrat|not to scale|demo/i.test(b.chip))
      warn("map", "the city is drawn, not mapped: keep \"Illustrative map\" (or similar) in the chip");
  }

  if (b.type === "anatomy-map") {
    for (const sc of b.scenes) {
      if (!env.fileExists(`public/${sc.photo}`)) err("assets", `missing image public/${sc.photo}`);
      if (sc.title.bold && !sc.title.text.includes(sc.title.bold)) warn("title", `bold "${sc.title.bold}" is not in "${sc.title.text}"`);
      if (sc.units === "percent")
        for (const r of sc.regions) if (r.points.some(([x, y]) => x < 0 || x > 100 || y < 0 || y > 100)) err("regions", "percent points must be 0–100");
      const anchors = sc.regions.filter((r) => r.label).map((r) => r.anchor);
      if (anchors.length > 4) warn("labels", `${anchors.length} labels in one scene: earlier ones dim, but keep it readable (≤ 4)`);
    }
    const foci = b.scenes.filter((sc) => sc.focus).map((sc) => JSON.stringify(sc.focus));
    if (foci.length && (foci.length !== b.scenes.length || new Set(foci).size > 1))
      err("focus", "all chapters must use the same focus box (before/after must be framed identically)");
    if (b.clinical && !b.demo) {
      if (!b.consent) err("consent", "patient photos need written consent (consent.file)");
      else {
        if (!env.fileExists(b.consent.file)) err("consent", `consent file not found: ${b.consent.file}`);
        if (b.consent.file.startsWith("public/")) err("consent", "consent forms must never be inside public/");
        if (!b.consent.scope.includes("social-media")) err("consent", "consent scope does not cover social media");
      }
    }
  }

  if (b.type === "photo-layout") {
    for (const ph of b.photos) if (!env.fileExists(`public/${ph.src}`)) err("assets", `missing image public/${ph.src}`);
    if (b.layout === "split" && b.photos.length !== 2) err("layout", "split needs exactly 2 photos");
    if (b.layout === "grid" && b.photos.length < 2) err("layout", "grid needs 2–4 photos");
    if (b.layout !== "annotate" && (b.annotations.length || b.loupe)) warn("layout", "annotations/loupe are only drawn in the annotate layout");
    if (b.clinical && !b.demo) {
      if (!b.consent) err("consent", "patient photos need written consent (consent.file)");
      else {
        if (!env.fileExists(b.consent.file)) err("consent", `consent file not found: ${b.consent.file}`);
        if (b.consent.file.startsWith("public/")) err("consent", "consent forms must never be inside public/");
        if (!b.consent.scope.includes("social-media")) err("consent", "consent scope does not cover social media");
      }
    }
  }

  if (b.type === "promo") {
    const p = b.proof;
    if (b.price.valid_until < env.today) (b.demo ? warn : err)("offer", `offer expired on ${b.price.valid_until}`);
    if (!/result|vary|varies/i.test(p.note) || !/assess/i.test(p.note))
      err("proof", "the note under the photos must say results vary and that treatment is subject to assessment");
    if (p.pending) {
      if (!b.demo) err("proof", "photos pending: keep demo: true until the real before/after photos and consent are in");
      else warn("proof", "placeholder photo boxes: real retractor photos + consent still needed");
    } else {
      for (const ph of [p.before, p.after]) if (!env.fileExists(`public/${ph}`)) err("assets", `missing image public/${ph}`);
      if (!p.before.startsWith(`cases/${p.case_id}/`) || !p.after.startsWith(`cases/${p.case_id}/`))
        err("privacy", `patient photos must live in public/cases/${p.case_id}/ (gitignored)`);
      if (!b.demo) {
        const c = p.consent;
        if (!c) err("consent", "patient photos need the patient's consent (proof.consent)");
        else {
          if (!c.scope.includes("social-media") || !c.scope.includes("ads"))
            err("consent", "a paid/organic ad needs consent scope covering social-media and ads");
          if (c.method === "written") {
            if (!c.file) err("consent", "written consent: give the form's path (assets/cases/<id>/...)");
            else {
              if (!env.fileExists(c.file)) err("consent", `consent file not found: ${c.file}`);
              if (c.file.startsWith("public/")) err("consent", "consent forms must never be inside public/");
            }
          } else {
            warn("consent", `verbal consent (taken ${c.taken_on} by ${c.taken_by}): a signed note is safer before paid boosting`);
            if (!c.identity_hidden) err("consent", "verbal consent only for photos where the patient cannot be identified (identity_hidden: true)");
          }
        }
      }
    }
    const num = (x?: string) => (x ? Number(x.replace(/[^\d.]/g, "")) : NaN);
    const now = num(b.price.now), was = num(b.price.was), pct = num(b.price.save);
    if (b.price.was && !(was > now)) err("price", "regular price must be higher than the offer price");
    if (b.price.save && b.price.was && Math.abs((1 - now / was) * 100 - pct) > 0.5)
      err("price", `"${b.price.save}" does not match ${b.price.was} → ${b.price.now}`);
    if (/\d/.test(b.price.now) && !b.prices_confirmed_on) (b.demo ? warn : err)("prices", "prices are clinic facts: set prices_confirmed_on");
    if (b.hero && /unknown|\?/i.test(b.hero.source))
      warn("licence", `hero photo source unclear ("${b.hero.source}"): a paid ad needs a licence that covers it`);
    if (b.visit && !env.fileExists(`public/${b.visit.photo}`)) err("assets", `missing image public/${b.visit.photo}`);
    if (b.hero && !env.fileExists(`public/${b.hero.src}`)) err("assets", `missing image public/${b.hero.src}`);
  }

  if (b.type === "procedure") {
    const n = PROCEDURE_STAGES[b.procedure].length;
    if (b.steps.length !== n) err("steps", `${b.procedure} animates ${n} stages (${PROCEDURE_STAGES[b.procedure].join(", ")}); give exactly ${n} steps`);
  }

  if (!b.demo && !b.review.approved_by)
    warn("review", "not yet approved by a dentist (review.approved_by); do not publish");

  return f;
}
