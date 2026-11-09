// Node-only: read + validate a brief file.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { brief, type Brief } from "./schema";

export function loadBrief(path: string): Brief {
  const raw = parse(readFileSync(path, "utf8"));
  const r = brief.safeParse(raw);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid brief ${path}:\n${msg}`);
  }
  return r.data;
}
