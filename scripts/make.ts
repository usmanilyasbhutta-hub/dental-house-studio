// One command: validate → render (+ loudness master) → QC.
// Usage: npm run make -- briefs/x.yaml
import { qc } from "./qc";
import { render } from "./render";

const file = process.argv[2];
if (!file) throw new Error("Usage: npm run make -- briefs/x.yaml");
await render(file);
const checks = qc(file);
for (const c of checks) console.log(`${c.status.padEnd(4)}  ${c.name}: ${c.detail}`);
const failed = checks.some((c) => c.status === "FAIL");
console.log(failed ? "\n✘ QC failed: see qc/<id>/report.md" : "\n✔ QC passed. Next: visual review of qc/<id>/contact.jpg, then dentist approval.");
process.exit(failed ? 1 : 0);
