import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { checkCompliance, type Finding } from "../src/brief/compliance";
import { loadBrief } from "../src/brief/load";
import type { Brief } from "../src/brief/schema";

export const today = () => new Date().toISOString().slice(0, 10);

/** Expand args (files or folders) into a list of .yaml/.yml brief paths. */
export function briefPaths(args: string[]): string[] {
  return args.flatMap((a) =>
    statSync(a).isDirectory()
      ? readdirSync(a).filter((f) => /\.ya?ml$/.test(f)).map((f) => join(a, f))
      : [a],
  );
}

export function validate(path: string): { brief: Brief; findings: Finding[] } {
  const brief = loadBrief(path);
  const findings = checkCompliance(brief, { today: today(), fileExists: existsSync });
  return { brief, findings };
}

export function printFindings(path: string, findings: Finding[]) {
  if (!findings.length) return console.log(`✔ ${path}`);
  const bad = findings.some((f) => f.level === "error");
  console.log(`${bad ? "✘" : "!"} ${path}`);
  for (const f of findings) console.log(`   ${f.level === "error" ? "ERROR" : "warn "} [${f.rule}] ${f.message}`);
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
export const flag = (name: string) => process.argv.includes(`--${name}`);
