// Node-only: read + validate a brief file.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { brief, type Brief } from "./schema";

/**
 * In YAML flow maps `{ small: Soft brush, light pressure }` the comma silently splits the text:
 * "light pressure" becomes a key with no value. Find those before the schema strips them.
 */
export function findCommaSplits(node: unknown, path = ""): string[] {
  if (Array.isArray(node)) return node.flatMap((v, i) => findCommaSplits(v, `${path}[${i}]`));
  if (node && typeof node === "object")
    return Object.entries(node).flatMap(([k, v]) =>
      v === null && /\s/.test(k) ? [`${path ? path + "." : ""}"${k}"`] : findCommaSplits(v, path ? `${path}.${k}` : k),
    );
  return [];
}

export function loadBrief(path: string): Brief {
  const raw = parse(readFileSync(path, "utf8"));
  const splits = findCommaSplits(raw);
  if (splits.length)
    throw new Error(`Invalid brief ${path}:\n${splits.map((s) => `  - ${s}: text with a comma inside { } must be quoted, e.g. small: "a, b"`).join("\n")}`);
  const r = brief.safeParse(raw);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid brief ${path}:\n${msg}`);
  }
  return r.data;
}
