"""Synthetic occlusal molar illustrations (NOT a patient) for the anatomy-map demo:
before = Class II cavity prep (orange dentin, buccal pit), after = restored surface with fissures.
Rubber-dam blue background, 1200x1500. Region coordinates used by briefs/examples/anatomy-map.yaml."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1200, 1500
OUT = Path(__file__).resolve().parent.parent / "public" / "cases" / "demo-molar"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(5)


def base():
    y = np.linspace(0, 1, H)[:, None]
    bg = np.zeros((H, W, 3))
    bg[..., 0] = 110 + 20 * y; bg[..., 1] = 172 + 10 * y; bg[..., 2] = 222 - 8 * y  # rubber-dam blue
    bg += rng.normal(0, 2.5, bg.shape)
    img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for cx in (-260, W + 260):  # neighbouring teeth at the edges
        d.ellipse([cx - 360, 360, cx + 360, 1140], fill=(236, 222, 196))
    # molar crown (rounded square) with soft shading ring
    d.rounded_rectangle([230, 330, 980, 1110], radius=260, fill=(241, 228, 202))
    shade = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shade).rounded_rectangle([230, 330, 980, 1110], radius=260, outline=255, width=40)
    img = Image.composite(Image.new("RGB", (W, H), (214, 196, 166)), img, shade.filter(ImageFilter.GaussianBlur(28)))
    return img


def finish(img, path):
    img = img.filter(ImageFilter.GaussianBlur(1.6))
    a = np.asarray(img).astype(np.float32) + rng.normal(0, 3, (H, W, 3))
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    ImageDraw.Draw(img).text((24, 24), "SYNTHETIC ILLUSTRATION - NOT A PATIENT", fill=(255, 255, 255))
    img.save(path, quality=92)


# BEFORE: occlusal box + mesial (right) extension = Class II; buccal pit at the top
b = base(); d = ImageDraw.Draw(b)
cavity = [(330, 640), (420, 600), (560, 620), (700, 590), (850, 600), (960, 610), (975, 720), (965, 860), (900, 890), (760, 900), (640, 930), (500, 910), (370, 880), (320, 780)]
d.polygon(cavity, fill=(233, 168, 98))
d.ellipse([470, 400, 720, 540], fill=(232, 176, 112))  # buccal pit
finish(b, OUT / "before.jpg")

# AFTER: restored, cusps with fissure pattern
a = base(); d = ImageDraw.Draw(a)
for p in [(605, 470, 780, 880, 700, 1000), (605, 470, 430, 900, 600, 1010)]:
    pass
fissures = [[(600, 470), (610, 650), (600, 760)], [(610, 650), (800, 600), (920, 640)], [(610, 650), (420, 620), (330, 660)], [(600, 760), (760, 900), (830, 1000)], [(600, 760), (450, 900), (400, 990)], [(600, 760), (600, 1040)]]
for line in fissures:
    d.line(line, fill=(196, 168, 128), width=9, joint="curve")
finish(a, OUT / "after.jpg")
print("written", list(OUT.iterdir()))
