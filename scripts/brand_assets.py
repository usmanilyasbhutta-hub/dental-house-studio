"""Build transparent brand PNGs from the source JPEGs (logo on white).

alpha = clip((245 - min(R,G,B)) / 60, 0, 1); colour is un-premultiplied against
white, cropped to its bounding box and upscaled 2x. Writes full-colour and
all-white versions of the logo and the house mark into public/brand/.
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "brand" / "source", ROOT / "public" / "brand"
OUT.mkdir(parents=True, exist_ok=True)


def to_rgba(path: Path, crop_right: int | None = None) -> np.ndarray:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    if crop_right:
        rgb = rgb[:, :crop_right]
    a = np.clip((245 - rgb.min(axis=2)) / 60, 0, 1)
    safe = np.maximum(a, 1e-3)[..., None]
    col = np.clip((rgb - 255 * (1 - a[..., None])) / safe, 0, 255)
    rgba = np.dstack([col, a * 255]).astype(np.uint8)
    ys, xs = np.where(a > 0.02)
    return rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def save(rgba: np.ndarray, name: str) -> None:
    img = Image.fromarray(rgba, "RGBA")
    img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    img.save(OUT / f"{name}.png")
    white = np.asarray(img).copy()
    white[..., :3] = 247  # brand white #F7F8F6 (close enough for a mask)
    Image.fromarray(white, "RGBA").save(OUT / f"{name}-white.png")
    print(f"wrote {name}.png / {name}-white.png  {img.size}")


save(to_rgba(SRC / "logo.jpg"), "logo")
# mark.jpg has the edge of the wordmark on its right; keep only the house.
save(to_rgba(SRC / "mark.jpg", crop_right=418), "mark")
