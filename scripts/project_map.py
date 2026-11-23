"""Project map ("graphify" idea, our own code): one compact page that tells Claude where everything is, so a new chat
reads the map instead of opening dozens of files. Saves tokens = saves credits.

  python3 scripts/project_map.py          # writes docs/project-map.md and docs/project-graph.json
  python3 scripts/project_map.py --check  # exit 1 if the map is out of date (CI / hooks)

For every tracked source file: size (≈ tokens), one-line purpose (first doc comment / docstring), what it exports,
and which project files it imports. Plus a "where to look for…" index of brief types, effects and commands.
"""
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = re.compile(r"^(public|assets|references|out|qc|apps)/|__pycache__|\.(png|jpg|jpeg|wav|mp3|mp4|webm|woff2?|glb|pyc|lock)$|package-lock\.json$|^docs/project-(map\.md|graph\.json)$")


def files():
    out = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).split()
    return sorted(f for f in out if not SKIP.search(f))


def purpose(path, text):
    if path.endswith((".ts", ".tsx", ".mjs", ".js")):
        m = re.search(r"/\*\*?\s*\n?\s*\*?\s*(.+?)(?:\n|\*/)", text) or re.search(r"^//\s*(.+)$", text, re.M)
    elif path.endswith(".py"):
        m = re.search(r'^"""(.+?)(?:\n|""")', text, re.S)
    elif path.endswith(".md"):
        m = re.search(r"^description:\s*(.+)$", text, re.M) or re.search(r"^#\s+(.+)$", text, re.M)
    elif path.endswith((".yaml", ".yml")):
        m = re.search(r"^#\s*(.+)$", text, re.M) or re.search(r"^title:\s*(.+)$", text, re.M)
    elif path.endswith(".sh"):
        m = re.search(r"^#\s*(?!\!)(.+)$", text, re.M)
    else:
        m = None
    s = (m.group(1) if m else "").strip().strip('"').strip()
    return (s[:117] + "…") if len(s) > 118 else s


def exports(path, text):
    if path.endswith((".ts", ".tsx")):
        names = re.findall(r"^export (?:const|function|type|interface|class|async function) (\w+)", text, re.M)
    elif path.endswith(".py"):
        names = [n for n in re.findall(r"^def (\w+)", text, re.M) if not n.startswith("_")]
    else:
        names = []
    return names


def imports(path, text, known):
    deps = set()
    if path.endswith((".ts", ".tsx")):
        for spec in re.findall(r"from\s+['\"](\.[^'\"]+)['\"]", text):
            base = (ROOT / path).parent / spec
            for ext in ("", ".ts", ".tsx", "/index.ts"):
                cand = str((base.parent / (base.name + ext)).resolve().relative_to(ROOT)) if (base.parent / (base.name + ext)).exists() else None
                if cand and cand in known:
                    deps.add(cand)
                    break
    elif path.endswith(".py"):
        for mod in re.findall(r"^\s*import (\w+)|^\s*from (\w+) import", text, re.M):
            name = mod[0] or mod[1]
            cand = str(Path(path).parent / f"{name}.py")
            if cand in known:
                deps.add(cand)
    return sorted(deps)


def build():
    fs = files()
    known = set(fs)
    nodes, edges = [], []
    for f in fs:
        text = (ROOT / f).read_text(errors="ignore")
        n = {"file": f, "kb": round(len(text.encode()) / 1024, 1), "tokens": len(text) // 4, "purpose": purpose(f, text), "exports": exports(f, text)}
        nodes.append(n)
        edges += [[f, d] for d in imports(f, text, known)]
    used_by = defaultdict(list)
    for a, b in edges:
        used_by[b].append(a)
    return nodes, edges, used_by


def index_section():
    """Hand-picked entry points, derived from the code so they stay true."""
    schema = (ROOT / "src/brief/schema.ts").read_text()
    types = re.findall(r'type: z\.literal\("([\w-]+)"\)', schema)
    pkg = json.loads((ROOT / "package.json").read_text())["scripts"]
    lines = ["## Where to look", "",
             f"- **Brief types ({len(types)})**: {', '.join(types)}. Contract: `src/brief/schema.ts`; rules: `src/brief/compliance.ts`;",
             "  duration: `src/brief/timing.ts`; template switch: `src/Video.tsx` → `src/templates/<Type>.tsx`; examples: `briefs/examples/`.",
             "- **Effects**: catalogue and rules `docs/effects.md`; code `src/fx/` (effects.tsx 1–18, footage*.tsx 19–50, looks.tsx, reel3.tsx).",
             "- **3D**: three.js `src/three/`; Blender `scripts/blender/` (modelgen = text → 3D, directions = looks, composite_clip).",
             "- **Taste and decisions**: `docs/taste.md` (read before creative choices), `docs/style-profile.md`, `docs/style-recipes.md`.",
             "- **Brand and clinic facts**: `src/brand.ts` only. Themes: `src/theme.ts`.",
             "- **Smile Studio app** (`apps/smile-studio/`, not listed below): its own ~2k-token index with symbols and line numbers,",
             "  `apps/smile-studio/docs/code-index.md` (`python3 scripts/app_index.py`; one file in full: `--file src/<file>`).",
             f"- **npm scripts**: {', '.join(f'`{k}`' for k in pkg)}.", ""]
    return lines


def render(nodes, edges, used_by):
    total = sum(n["tokens"] for n in nodes)
    out = ["# Project map (generated: `python3 scripts/project_map.py`; do not edit by hand)", "",
           f"{len(nodes)} source files, about {total:,} tokens if read in full. **Read this map first and open only the files a task needs;**",
           "for big files, search (`grep -n`) and read the relevant lines instead of the whole file.", ""]
    out += index_section()
    groups = defaultdict(list)
    for n in nodes:
        top = n["file"].split("/")[0] if "/" in n["file"] else "(root)"
        sub = "/".join(n["file"].split("/")[:2]) if n["file"].count("/") >= 2 else top
        groups[sub].append(n)
    out += ["## Files", "", "`~tok` = rough tokens to read the whole file. ⚠ = over 4k tokens: grep it, don't read it whole.", ""]
    for g in sorted(groups):
        out.append(f"### {g}")
        for n in groups[g]:
            warn = " ⚠" if n["tokens"] > 4000 else ""
            ex = f" · exports: {', '.join(n['exports'][:8])}{'…' if len(n['exports']) > 8 else ''}" if n["exports"] else ""
            ub = used_by.get(n["file"], [])
            usedby = f" · used by {len(ub)}" if ub else ""
            out.append(f"- `{n['file']}` ~{n['tokens']}tok{warn}: {n['purpose'] or '—'}{ex}{usedby}")
        out.append("")
    return "\n".join(out) + "\n"


def main():
    nodes, edges, used_by = build()
    md = render(nodes, edges, used_by)
    graph = json.dumps({"nodes": nodes, "edges": edges}, indent=0)
    mp, gp = ROOT / "docs/project-map.md", ROOT / "docs/project-graph.json"
    if "--check" in sys.argv:
        stale = not mp.exists() or mp.read_text() != md
        print("project map is " + ("OUT OF DATE: run python3 scripts/project_map.py" if stale else "up to date"))
        sys.exit(1 if stale else 0)
    mp.write_text(md)
    gp.write_text(graph)
    print(f"map → docs/project-map.md (~{len(md) // 4:,} tokens) · graph → docs/project-graph.json ({len(nodes)} files, {len(edges)} links)")


if __name__ == "__main__":
    main()
