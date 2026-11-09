// Usage: npm run validate -- briefs/my-video.yaml [more files or folders]
// Exit code 1 if any brief is invalid or has compliance ERRORS.
import { briefPaths, printFindings, validate } from "./lib";

const paths = briefPaths(process.argv.slice(2).length ? process.argv.slice(2) : ["briefs"]);
let failed = false;
for (const p of paths) {
  try {
    const { findings } = validate(p);
    printFindings(p, findings);
    if (findings.some((f) => f.level === "error")) failed = true;
  } catch (e) {
    console.log(`✘ ${(e as Error).message}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
