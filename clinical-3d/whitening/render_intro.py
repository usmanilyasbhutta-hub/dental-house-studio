"""Assessment + shade-check opening for the patient-information cut (owner, 14 Nov 2026).

Same frame, crop and scale as render.py, so it joins the treatment sequence seamlessly:
  0.0-4.9 s  mirror retracts at the patient's right corner; periodontal probe walks the gingival margin of the six
             illustrated upper anterior teeth (tip dips ~1.5 mm into the sulcus, hidden by the gum).
  4.9-8.0 s  one shade-guide tab held edge to edge under the upper right central incisor (no shade code).
Usage: WH_TOOLS=assets_generic python3 render_intro.py [--stills]
"""
import math, os, subprocess, sys
from pathlib import Path

os.environ.setdefault("WH_TOOLS", str(Path(__file__).parent / "assets_generic"))
sys.path.insert(0, str(Path(__file__).parent))
import render as R  # noqa: E402  (loads the case photo, crop, tool compositor)
import case_geometry as G  # noqa: E402
from PIL import Image, ImageDraw, ImageChops, ImageOps  # noqa: E402

FPS, DUR = R.FPS, 8.0
T = R.TOOLS


def load(name, flip=False):
    im = Image.open(T / name).convert("RGBA")
    return ImageOps.mirror(im) if flip else im


probe = [load(f"probe_pose{i}.png") for i in range(5)]
mirror = load("mirror_pose0.png", flip=True)  # handle to the lower left (other hand of the same pose)
tab = load("shade_tab_pose0.png")
shadows = {id(v): R.make_shadow(v) for v in probe + [mirror, tab]}

# Gum above the traced margin: anything of the probe drawn here is inside the sulcus and hidden.
gum = Image.new("L", (R.W, R.H))
pts = [R.point(p) for p in R.smooth(G.MARGIN)]
ImageDraw.Draw(gum).polygon([(pts[0][0], 0)] + pts + [(pts[-1][0], 0)], fill=255)

# Probing sites: mid-facial and mesial line angle of each illustrated upper anterior tooth, left to right.
sites = []
for crown in G.CROWNS:
    xs = [x for x, _ in crown[:8]]
    lo, hi = min(xs), max(xs)
    sites += [lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.82]
WALK = (0.55, 4.55)


def ease(x):
    return R.ease(x)


def reflect(layer, near):
    """Fill the green-keyed mirror glass with a blurred, flipped view of the real photo around it."""
    r, g, b, a = layer.split()
    key = ImageChops.subtract(g, ImageChops.lighter(r, b)).point(lambda v: 255 if v > 90 else round(v * 255 / 90))
    if not key.getbbox():
        return
    x, y = R.point(near)
    from PIL import ImageFilter, ImageEnhance
    # whole frame mirrored about the head centre, so the glass is always fully covered
    flipped = ImageEnhance.Brightness(ImageOps.mirror(R.initial).filter(ImageFilter.GaussianBlur(5))).enhance(0.82)
    canvas = Image.new("RGB", layer.size, (90, 40, 40))
    canvas.paste(flipped, (int(max(2 * x - R.W, -R.W + 620)), 0))  # covers the whole glass
    glass = canvas.convert("RGBA")
    glass.putalpha(ImageChops.multiply(key, a))
    layer.alpha_composite(glass)


def place(layer, v, p, alpha=1.0, lift=0.0):
    """Composite a tool render with its origin at source point p (with entry/exit lift)."""
    v = v.copy()
    sh = shadows.get(id(v)) or R.make_shadow(v)
    if alpha < 1:
        v.putalpha(v.getchannel("A").point(lambda a: round(a * alpha)))
        sh = sh.copy()
        sh.putalpha(sh.getchannel("A").point(lambda a: round(a * alpha)))
    R.composite_tool(layer, v, sh.resize((R.ASSET, R.ASSET)), (p[0], p[1] + 30 * lift), R.FACTOR)


def probe_tip(t):
    k = max(0.0, min(1.0, (t - WALK[0]) / (WALK[1] - WALK[0]))) * (len(sites) - 1)
    i = min(len(sites) - 2, int(k))
    f = k - i
    x = sites[i] + (sites[i + 1] - sites[i]) * (f * f * (3 - 2 * f))
    dip = math.sin(math.pi * f) ** 2 if WALK[0] <= t <= WALK[1] else 0.0
    depth = 9.0 * (1 - dip)  # ~1.5 mm in the sulcus at each site, lifted while walking to the next
    return x, G.margin_y(x) - depth


def frame(t):
    im = R.initial.convert("RGBA")
    if t < 4.9:
        a_in, a_out = ease(t / 0.35), ease((4.9 - t) / 0.35)
        # mirror: retracting at the patient's right corner (image left), steel back towards the camera
        ml = Image.new("RGBA", im.size)
        place(ml, mirror, (345, 266), 1.0, 1 - a_in * a_out)
        reflect(ml, (345, 266))
        if min(a_in, a_out) < 1:
            ml.putalpha(ml.getchannel("A").point(lambda q: round(q * min(a_in, a_out))))
        im.alpha_composite(ml)
        # probe: on its own layer so the inserted tip can be hidden by the gum
        x, y = probe_tip(t)
        u = max(0, min(1, (x - 390) / 240)) * 4
        layer = Image.new("RGBA", im.size)
        place(layer, probe[round(u)], (x, y), min(a_in, a_out), 1 - a_in * a_out)
        hide = gum if WALK[0] - 0.1 <= t <= WALK[1] + 0.1 else Image.new("L", im.size)
        layer.putalpha(ImageChops.subtract(layer.getchannel("A"), hide))
        im.alpha_composite(layer)
    else:
        a = min(ease((t - 4.9) / 0.4), ease((DUR - t) / 0.35))
        c = G.CROWNS[2]
        xs = [x for x, _ in c]
        edge = (min(xs) + max(xs)) / 2, max(y for _, y in c) + 1.5
        place(im, tab, edge, a, 1 - a)
    return im.convert("RGB")


if __name__ == "__main__" and "--stills" in sys.argv:
    out = Path(__file__).parent / "checks"
    out.mkdir(exist_ok=True)
    for t in [0.2, 1.0, 1.4, 2.5, 3.9, 6.2]:
        frame(t).save(out / f"intro_{t}.jpg", quality=90)
elif __name__ == "__main__":
    out = R.P.parents[1] / "out" / "whitening_intro_generic.mp4"
    q = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{R.W}x{R.H}", "-r", str(FPS), "-i", "-",
                          "-an", "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", str(out)], stdin=subprocess.PIPE)
    for n in range(int(DUR * FPS)):
        q.stdin.write(frame(n / FPS).tobytes())
    q.stdin.close()
    assert q.wait() == 0
    print(out)
