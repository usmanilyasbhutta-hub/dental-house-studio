"""App code index (graphify idea, our own code): one ~2k-token page per app listing, for every file, its purpose, local
imports, outside packages and its main symbols with line numbers, so a chat can jump straight to `file:line` instead
of opening big files.

  python3 scripts/app_index.py                         # writes apps/smile-studio/docs/code-index.md (runs in npm run map / check)
  python3 scripts/app_index.py --check                 # exit 1 if the index is out of date
  python3 scripts/app_index.py --file src/planner.ts   # every symbol of one file with its line (stdout, nothing written)

Symbols are ranked by how many other app files import them (the real API first), then exported functions, then
big files' internal functions, then types. Each file keeps as many as fit the budget; the rest show as "+N".
Regex-based on purpose: no TypeScript compiler needed, runs in well under a second.
"""
import posixpath
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = "apps/smile-studio"
OUT = f"{APP}/docs/code-index.md"
BUDGET = 2000            # target tokens for the whole page (≈ chars / 4, same measure as docs/project-map.md)
BIG = 4000               # tokens: files above this get ⚠ and list internal functions too
CODE = re.compile(r"\.(tsx?|mjs|cjs|js|py)$")
SKIP_EXT = {"react", "react-dom", "react/jsx-runtime", "vitest", "fs", "path", "url", "child_process", "os", "crypto",
            "http", "https", "zlib", "stream", "util", "worker_threads", "module", "assert", "events"}


def app_files():
    out = subprocess.check_output(["git", "ls-files", APP], cwd=ROOT, text=True).split()
    keep = [f for f in out if CODE.search(f) and "/.tmp/" not in f and not f.endswith(("vite.config.ts",))]
    return sorted(f[len(APP) + 1:] for f in keep)


def readme_purposes():
    p = ROOT / APP / "README.md"
    rows = re.findall(r"^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*$", p.read_text(), re.M) if p.exists() else []
    return dict(rows)


def purpose(text, fallback):
    """The file's header comment: the first comment block that is followed by a blank line or an import (a comment
    sitting directly on a declaration documents that symbol, not the file)."""
    lines = text.splitlines()[:40]
    i, top = 0, True                                 # top: nothing but blank lines so far
    while i < len(lines):
        s = lines[i].strip()
        if not s or s.startswith(("import ", "#!", "'use", '"use', "from ")):
            top = top and (not s or s.startswith("#!"))
            i += 1
            continue
        if not re.match(r'^(//|/\*|#(?!!)|""")', s):
            break                                   # reached code: no header comment
        block, j = [], i
        if s.startswith(("/*", '"""')):
            close, skip = ("*/", 2) if s.startswith("/*") else ('"""', 3)
            block.append(lines[j])
            if close not in s[skip:]:                # multi-line block: run to the closing line
                j += 1
                while j < len(lines) and close not in lines[j]:
                    block.append(lines[j])
                    j += 1
                if j < len(lines):
                    block.append(lines[j])
        else:
            mark = s[:2] if s.startswith("//") else "#"
            while j < len(lines) and lines[j].strip().startswith(mark):
                block.append(lines[j])
                j += 1
            j -= 1
        nxt = lines[j + 1].strip() if j + 1 < len(lines) else ""
        if top or nxt == "" or nxt.startswith(("import ", "from ")):
            strip = lambda b: re.sub(r'^\s*(?://+|/\*+|\*|#|""")\s*', "", b).replace("*/", "").replace('"""', "").strip()
            joined = " ".join(t for t in map(strip, block) if t)
            first = re.split(r"(?<=[.!?])\s", joined, maxsplit=1)[0]
            if first:
                return _clip(first)
        top = False
        i = j + 1
    return _clip(fallback or "")


def _clip(p):
    p = re.sub(r"\s*\(unit-tested\)|\s*\(tests/[^)]*\)", "", p).rstrip(".:")
    return p if len(p) <= 72 else p[:71].rsplit(" ", 1)[0] + "…"


SYM_TS = [
    (re.compile(r"^export\s+(?:default\s+)?(?:async\s+)?function\*?\s+(\w+)"), "fn", True),
    (re.compile(r"^export\s+(?:default\s+)?class\s+(\w+)"), "class", True),
    (re.compile(r"^export\s+const\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>"), "fn", True),
    (re.compile(r"^export\s+const\s+(\w+)\s*(?::[^=]+)?=\s*(?:React\.)?(?:memo|forwardRef|lazy)\("), "fn", True),
    (re.compile(r"^export\s+(?:const|let)\s+(\w+)"), "const", True),
    (re.compile(r"^export\s+(?:type|interface|enum)\s+(\w+)"), "type", True),
    (re.compile(r"^(?:async\s+)?function\*?\s+(\w+)"), "fn", False),
    (re.compile(r"^const\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>"), "fn", False),
    (re.compile(r"^class\s+(\w+)"), "class", False),
]
SYM_PY = [(re.compile(r"^def (\w+)"), "fn", True), (re.compile(r"^class (\w+)"), "class", True)]


def symbols(path, text):
    pats = SYM_PY if path.endswith(".py") else SYM_TS
    out = []
    for i, line in enumerate(text.splitlines(), 1):
        for rx, kind, exported in pats:
            m = rx.match(line)
            if m:
                out.append({"name": m.group(1), "kind": kind, "exp": exported, "line": i})
                break
    if not path.endswith(".py"):     # export { a, b } lists
        for m in re.finditer(r"^export\s*\{([^}]*)\}", text, re.M):
            ln = text.count("\n", 0, m.start()) + 1
            for n in re.findall(r"(?:\w+\s+as\s+)?(\w+)", m.group(1)):
                out.append({"name": n, "kind": "fn", "exp": True, "line": ln})
    return out


def resolve(src, spec, known):
    base = posixpath.normpath(posixpath.join(posixpath.dirname(src), spec))
    for ext in ("", ".ts", ".tsx", ".js", ".mjs", ".cjs", "/index.ts", "/index.tsx"):
        if base + ext in known:
            return base + ext
    return None


def imports(path, text, known):
    """Local files this file uses (static, dynamic, lazy, workers) + named symbols + outside packages."""
    local, named, ext = set(), defaultdict(set), set()
    if path.endswith(".py"):
        return local, named, ext
    for m in re.finditer(r"import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*[\"'](\.[^\"']+)[\"']", text):
        dep = resolve(path, m.group(2), known)
        if dep:
            named[dep] |= set(re.findall(r"(?:type\s+)?(\w+)(?:\s+as\s+\w+)?", m.group(1))) - {"type", "as"}
    for spec in re.findall(r"[\"'](\.\.?/[^\"']+)[\"']", text):
        dep = resolve(path, spec, known)
        if dep and dep != path:
            local.add(dep)
    for spec in re.findall(r"(?:from\s+|import\s*\(\s*|require\(\s*|^import\s+)[\"']([^.\"'][^\"']*)[\"']", text, re.M):
        if spec.startswith("node:"):
            continue
        pkg = "/".join(spec.split("/")[:2]) if spec.startswith("@") else spec.split("/")[0]
        if pkg not in SKIP_EXT and spec not in SKIP_EXT:
            ext.add(pkg)
    return local, named, ext


def build():
    fs = app_files()
    known = set(fs)
    rp = readme_purposes()
    nodes = {}
    for f in fs:
        text = (ROOT / APP / f).read_text(errors="ignore")
        local, named, ext = imports(f, text, known)
        nodes[f] = {"file": f, "tokens": len(text) // 4, "purpose": purpose(text, rp.get(f)), "syms": symbols(f, text),
                    "local": sorted(local), "named": named, "ext": sorted(ext)}
    use = defaultdict(int)           # (file, symbol) -> number of other files importing it
    use_app = defaultdict(int)       # same, counting only app code (src/), so test-only helpers don't rank as API
    used_by = defaultdict(set)
    for f, n in nodes.items():
        for dep in n["local"]:
            used_by[dep].add(f)
        for dep, names in n["named"].items():
            for s in names:
                use[(dep, s)] += 1
                use_app[(dep, s)] += f.startswith("src/")
    for f, n in nodes.items():
        big = n["tokens"] > BIG
        seen, ranked = set(), []
        for s in n["syms"]:
            if s["name"] in seen:
                continue
            seen.add(s["name"])
            s["uses"], app_uses = use[(f, s["name"])], use_app[(f, s["name"])]
            tier = (0 if app_uses and s["kind"] != "type" else
                    1 if s["exp"] and s["kind"] in ("fn", "class") else
                    2 if s["exp"] and s["kind"] == "const" else
                    3 if not s["exp"] and big else
                    4 if s["kind"] == "type" else 9)
            if tier < 9:
                ranked.append((tier, -app_uses, -s["uses"], s["line"], s))
        n["ranked"] = [r[-1] for r in sorted(ranked, key=lambda r: r[:4])]
        n["used_by"] = sorted(used_by[f])
    return nodes


def short(f):
    """src/ai/map.ts -> ai/map ; tests/fit.test.ts -> tests/fit.test"""
    s = re.sub(r"\.(tsx?|mjs|cjs|js|py)$", "", f)
    return s[4:] if s.startswith("src/") else s


def sym_str(s):
    if s["kind"] == "type":
        return s["name"]
    mark = "" if s["exp"] else "·"          # · = internal (not exported)
    return f"{mark}{s['name']}:{s['line']}"


def file_line(n, cap):
    warn = " ⚠" if n["tokens"] > BIG else ""
    head = f"- `{short(n['file'])}` {n['tokens'] // 1000 if n['tokens'] >= 1000 else '<1'}k{warn}"
    parts = [n["purpose"]] if n["purpose"] else []
    if n["local"]:
        parts.append("← " + " ".join(short(d) for d in n["local"]))
    if n["ext"]:
        parts.append("pkg " + " ".join(n["ext"]))
    syms = n["ranked"]
    if syms and cap:
        shown = syms[:cap]
        more = f" +{len(syms) - cap}" if len(syms) > cap else ""
        parts.append(", ".join(sym_str(s) for s in shown if s["kind"] != "type"))
        types = [s["name"] for s in shown if s["kind"] == "type"]
        if types:
            parts.append("types " + " ".join(types))
        parts[-1] += more
        parts = [p for p in parts if p]
    elif syms:
        parts.append(f"{len(syms)} symbols")
    return head + ": " + " · ".join(parts)


def group_line(title, ns):
    """Tests / e2e collapsed to one line each: which modules they cover."""
    covers = sorted({short(d) for n in ns for d in n["local"] if d.startswith("src/")})
    names = " ".join(short(n["file"]).split("/")[-1].replace(".test", "") for n in ns)
    tok = sum(n["tokens"] for n in ns) // 1000
    return f"- **{title}** ({len(ns)} files, {tok}k): {names}" + (f" · cover {' '.join(covers)}" if covers else "")


def render(nodes, cap):
    src = [n for f, n in nodes.items() if f.startswith("src/")]
    other = [n for f, n in nodes.items() if not f.startswith(("src/", "tests/", "e2e/"))]
    tests = [n for f, n in nodes.items() if f.startswith("tests/")]
    e2e = [n for f, n in nodes.items() if f.startswith("e2e/")]
    total = sum(n["tokens"] for n in nodes.values())
    out = [f"# Smile Studio code index (generated by `python3 scripts/app_index.py`; do not edit)", "",
           f"{len(nodes)} code files in `{APP}/`, ~{total // 1000}k tokens if read in full. Find the symbol here, then read "
           f"only around it: `sed -n 'L-20,L+60p' {APP}/src/<file>`. All symbols of one file: `python3 scripts/app_index.py --file src/<file>`.",
           f"Key: `name:line` exported · `·name:line` internal · `← a b` imports · ⚠ >{BIG // 1000}k tokens, never read whole · "
           "symbols ranked by how many app files import them.", ""]
    out += ["## src", ""] + [file_line(n, cap) for n in sorted(src, key=lambda n: n["file"])] + [""]
    out += ["## Other code", ""] + [file_line(n, min(cap, 3)) for n in other]
    out += [group_line("tests (vitest)", tests), group_line("e2e (Playwright, `npm run e2e`)", e2e), ""]
    return "\n".join(out) + "\n"


def fit(nodes):
    """Largest per-file symbol cap that keeps the page within BUDGET tokens."""
    best = render(nodes, 0)
    for cap in range(1, 40):
        md = render(nodes, cap)
        if len(md) // 4 > BUDGET:
            break
        best = md
    return best


def one_file(nodes, f):
    f = f[len(APP) + 1:] if f.startswith(APP) else f
    n = nodes.get(f)
    if not n:
        sys.exit(f"not in the index: {f} (paths are relative to {APP}/, e.g. src/planner.ts)")
    print(f"{APP}/{f} · ~{n['tokens']} tokens · {n['purpose']}")
    print("imports:", " ".join(n["local"]) or "—", "| packages:", " ".join(n["ext"]) or "—")
    print("used by:", " ".join(n["used_by"]) or "—")
    for s in sorted(n["syms"], key=lambda s: s["line"]):
        u = s.get("uses", 0)
        print(f"  {s['line']:>5}  {'export ' if s['exp'] else '       '}{s['kind']:<5} {s['name']}" + (f"  (imported by {u})" if u else ""))


def main():
    nodes = build()
    if "--file" in sys.argv:
        return one_file(nodes, sys.argv[sys.argv.index("--file") + 1])
    md = fit(nodes)
    path = ROOT / OUT
    if "--check" in sys.argv:
        stale = not path.exists() or path.read_text() != md
        print("app code index is " + ("OUT OF DATE: run python3 scripts/app_index.py" if stale else "up to date"))
        sys.exit(1 if stale else 0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(md)
    print(f"app index → {OUT} (~{len(md) // 4:,} tokens, {len(nodes)} files)")


if __name__ == "__main__":
    main()
