"""Reduction map: where a chat's tokens go and how to spend fewer (companion to the project map).

  python3 scripts/reduction_map.py          # writes docs/reduction-map.md
  python3 scripts/reduction_map.py --check  # exit 1 if out of date

Three parts: (1) the fixed cost every chat pays, (2) task recipes = the smallest set of files per common job with
its token cost, (3) a line-range index for every ⚠ file so Claude reads `sed -n A,Bp` instead of the whole file.
Token counts are rough (chars / 4), same as docs/project-map.md.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BIG = 4000
OUT = ROOT / "docs/reduction-map.md"


def tok(path):
    p = ROOT / path
    return len(p.read_text(errors="ignore")) // 4 if p.exists() else 0


def tracked():
    skip = re.compile(r"^(public|assets|references|out|qc)/|\.(png|jpg|jpeg|wav|mp3|mp4|webm|woff2?|glb|pyc|lock)$|package-lock\.json$|^docs/(project-(map\.md|graph\.json)|reduction-map\.md)$")
    out = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).split()
    return sorted(f for f in out if not skip.search(f))


# Always in context (loaded by Claude Code or required by CLAUDE.md's "read this first").
FIXED = [("CLAUDE.md", "auto-loaded every chat"), ("docs/project-map.md", "CLAUDE.md says: start here")]

# Task → files actually needed. "grep:" = search it, count ~400 tok instead of the whole file.
RECIPES = [
    ("Tweak copy / timing in an existing brief", ["briefs/<file>.yaml", "grep:src/brief/schema.ts"]),
    ("New brief of a known type (after /options)", ["docs/taste.md", "docs/style-profile.md", "grep:src/brief/schema.ts", "src/brief/compliance.ts", "briefs/examples/<same type>.yaml"]),
    ("Add / change an effect in a brief", ["grep:docs/effects.md", "briefs/<file>.yaml"]),
    ("Fix a bug in one template", ["src/templates/<Type>.tsx", "grep:src/brief/schema.ts", "src/theme.ts"]),
    ("Compliance / claims question", ["src/brief/compliance.ts"]),
    ("Clinic facts / brand colours", ["src/brand.ts"]),
    ("3D tooth / implant clip (modelgen)", ["docs/3d-detailing.md", "grep:scripts/blender/modelgen.py"]),
    ("Taste reaction to log", ["docs/taste.md"]),
    ("QC a render", ["qc/<id>/report.md", "qc/<id>/contact.jpg (image)"]),
]
GREP_COST = 400
EXAMPLE = {"briefs/<file>.yaml": 350, "briefs/examples/<same type>.yaml": 350, "src/templates/<Type>.tsx": 2500,
           "qc/<id>/report.md": 500, "qc/<id>/contact.jpg (image)": 1600}


def cost(item):
    if item.startswith("grep:"):
        return GREP_COST
    return EXAMPLE.get(item, tok(item))


ANCHOR = {
    ".md": re.compile(r"^#{1,3} (.+)$"),
    ".py": re.compile(r"^(?:# -{10,} (\w[\w ]*)|def (\w+))"),
    ".ts": re.compile(r"^(?:// -+ (.+?) -*$|export (?:const|function|type) (\w+))"),
}
ANCHOR[".tsx"] = re.compile(r"^(?:// -+ (.+?) -*$|export (?:const|function) (\w+)|(?:const|function) (\w+)\s*[:=(])")


def sections(path):
    """[(start_line, label)] for headings / section rules / top-level definitions."""
    rx = ANCHOR.get(Path(path).suffix)
    if not rx:
        return [], 0
    lines = (ROOT / path).read_text(errors="ignore").splitlines()
    out = []
    for i, line in enumerate(lines, 1):
        m = rx.match(line)
        if m:
            label = next(g for g in m.groups() if g).strip()
            if not out or out[-1][1] != label:
                out.append((i, label))
    return out, len(lines)


def ranges(path, max_rows=14):
    found, n = sections(path)
    if not found:
        return [f"1–{n}: (no anchors; grep -n for the name you need)"]
    spans = [(s, (found[k + 1][0] - 1 if k + 1 < len(found) else n), lab) for k, (s, lab) in enumerate(found)]
    # Merge small neighbours so the table stays short.
    while len(spans) > max_rows:
        k = min(range(len(spans) - 1), key=lambda j: (spans[j][1] - spans[j][0]) + (spans[j + 1][1] - spans[j + 1][0]))
        a, b = spans[k], spans[k + 1]
        spans[k:k + 2] = [(a[0], b[1], f"{a[2]}, {b[2]}" if len(a[2]) + len(b[2]) < 70 else f"{a[2]} … {b[2].split(', ')[-1]}")]
    return [f"{s}–{e}: {lab}" for s, e, lab in spans]


def render():
    files = tracked()
    sizes = {f: tok(f) for f in files}
    total = sum(sizes.values())
    fixed = sum(tok(f) for f, _ in FIXED)
    out = ["# Reduction map (generated: `python3 scripts/reduction_map.py`; do not edit by hand)", "",
           "Where a chat's tokens go and the cheapest way to do each job. Companion to `docs/project-map.md`.",
           f"Whole repo ≈ {total:,} tokens; a normal job should read **under 10k**.", "",
           "## 1. Fixed cost every chat pays", ""]
    for f, why in FIXED:
        out.append(f"- `{f}` ~{tok(f):,} tok: {why}")
    out += [f"- **Total ≈ {fixed:,} tok before any work.** Skip the project map when this reduction map's recipe already",
            "  names the files (most jobs below). Open the project map only for unfamiliar code.", "",
            "## 2. Task recipes (read only these)", "",
            "| Job | Files | ≈ tok |", "|---|---|---|"]
    for job, items in RECIPES:
        names = ", ".join(f"`{i[5:]}` (grep)" if i.startswith("grep:") else f"`{i}`" for i in items)
        out.append(f"| {job} | {names} | {sum(cost(i) for i in items):,} |")
    out += ["", "Images cost ~1.6k tok each: one contact sheet beats five stills. Logs: always `| tail -20` or `| grep`.", "",
            f"## 3. Big files (> {BIG // 1000}k tok): read by line range", "",
            "Use `sed -n A,Bp <file>` (or Read with offset/limit) on the range you need. Ranges are regenerated on `npm run map`.", ""]
    for f in sorted((f for f in files if sizes[f] > BIG), key=lambda f: -sizes[f]):
        out.append(f"### `{f}` ~{sizes[f]:,} tok")
        out += [f"- {r}" for r in ranges(f)]
        out.append("")
    heavy = sorted(sizes.items(), key=lambda kv: -kv[1])
    out += ["## 4. Where the remaining weight is", ""]
    groups = {}
    for f, t in sizes.items():
        g = "/".join(f.split("/")[:2]) if f.count("/") >= 2 else (f.split("/")[0] if "/" in f else "(root)")
        groups[g] = groups.get(g, 0) + t
    for g, t in sorted(groups.items(), key=lambda kv: -kv[1])[:10]:
        out.append(f"- `{g}/` ~{t:,} tok ({t * 100 // total}%)")
    out += ["", "## 5. Rules of thumb", "",
            "- Never read a ⚠ file whole; never re-read a file already read or just edited in this chat.",
            "- Briefs: copy the nearest example in `briefs/examples/` instead of reading the whole schema.",
            "- Check visuals with `npm run still` or a contact sheet; a full render only after the owner approves.",
            "- One chat per job; start a new chat instead of carrying a long one (old turns are re-sent every message).",
            f"- Biggest single file: `{heavy[0][0]}` (~{heavy[0][1]:,} tok). Grep it.", ""]
    return "\n".join(out)


def main():
    md = render()
    if "--check" in sys.argv:
        stale = not OUT.exists() or OUT.read_text() != md
        print("reduction map is " + ("OUT OF DATE: run python3 scripts/reduction_map.py" if stale else "up to date"))
        sys.exit(1 if stale else 0)
    OUT.write_text(md)
    print(f"reduction map → docs/reduction-map.md (~{len(md) // 4:,} tokens)")


if __name__ == "__main__":
    main()
