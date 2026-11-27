#!/usr/bin/env python3
"""Real-data location map for promo briefs (`own_map.style: real`): open, ad-safe sources only.

  NASA Blue Marble (public domain, via GIBS)  ->  public/footage/realmap/pakistan.jpg   (downloaded separately, lat 22-39, lon 58-82)
  Copernicus Sentinel-2 L2A true colour        ->  s2-wide.jpg (60 km, 40 m/px), s2-city.jpg (12.4 km, 10 m/px)
  OpenStreetMap (ODbL)                         ->  streets.png (brand-styled street map, 2 px per metre)
  + src/data/realmap.json: every layer's bounds in local metres around the clinic pin, the highlighted road, credits.

Google imagery is never used (not allowed for promotion). Credits must stay on screen.
Usage: python3 scripts/make_realmap.py   (needs rasterio; network: earth-search.aws.element84.com, sentinel-cogs.s3.us-west-2.amazonaws.com)
"""
import json, math, sys, xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/footage/realmap"
LAT0, LON0 = 32.5054616, 74.546536          # clinic pin (src/brand.ts clinic.location)
KX = 111320 * math.cos(math.radians(LAT0))   # metres per degree of longitude here
KY = 110540                                  # metres per degree of latitude
TILES = [  # same Sentinel-2 pass (22 Nov 2026, ~0 % cloud over Sialkot), two MGRS tiles mosaicked
    "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/43/S/DS/2026/11/S2C_43SDS_20261122_0_L2A/TCI.tif",
    "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/43/S/DR/2026/11/S2C_43SDR_20261122_0_L2A/TCI.tif",
]
S2_DATE = "2026-11-22"


def m(lat, lon):
    """local metres: x east, y north of the pin (equirectangular, fine at these scales)"""
    return ((lon - LON0) * KX, (lat - LAT0) * KY)


def s2(half_m: float, res: float, name: str):
    import rasterio
    from rasterio.warp import reproject, transform, Resampling
    from rasterio.transform import from_origin
    n = int(round(2 * half_m / res))
    dst = np.zeros((3, n, n), np.uint8)
    env = dict(GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif", CURL_CA_BUNDLE="/root/.ccr/ca-bundle.crt",
               GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR")
    parts = []
    with rasterio.Env(**env):
        for url in TILES:
            with rasterio.open("/vsicurl/" + url) as src:
                xs, ys = transform("EPSG:4326", src.crs, [LON0], [LAT0])
                dt = from_origin(xs[0] - half_m, ys[0] + half_m, res, res)
                part = np.zeros_like(dst)
                for b in range(3):
                    reproject(rasterio.band(src, b + 1), part[b], dst_transform=dt, dst_crs=src.crs, resampling=Resampling.average,
                              src_nodata=0, dst_nodata=0)
                parts.append(part)
    # tile 1 is the reference (the city view comes only from it); match tile 2's colour to it in the overlap (linear fit per band)
    dst[:] = parts[0]
    for part in parts[1:]:
        both = (dst.sum(0) > 0) & (part.sum(0) > 0)
        part = part.astype(np.float32)
        if both.sum() > 1000:
            for b in range(3):
                a, c = np.polyfit(part[b][both], dst[b][both].astype(np.float32), 1)
                part[b] = np.clip(a * part[b] + c, 1, 255) * (part[b] > 0)
        hole = dst.sum(0) == 0
        dst[:, hole] = part[:, hole].astype(np.uint8)
    img = Image.fromarray(np.moveaxis(dst, 0, -1))
    img.save(OUT / name, quality=90)
    print(name, img.size, "empty px:", int((dst.sum(0) == 0).sum()))
    return {"src": f"footage/realmap/{name}", "bounds": [-half_m, -half_m, half_m, half_m]}


# brand-styled street map (carousel paper look); colours only, geometry is OSM's
ST = dict(bg=(243, 238, 228), land_green=(221, 229, 208), water=(205, 220, 224), building=(229, 220, 204), building_line=(214, 203, 184),
          casing=(214, 204, 186), road=(255, 255, 255), major=(255, 252, 245), major_casing=(201, 186, 160), rail=(190, 182, 170))
WIDTH_M = {"primary": 16, "secondary": 14, "secondary_link": 9, "tertiary": 11, "unclassified": 8, "residential": 7,
           "living_street": 6, "service": 4.5, "track": 3, "footway": 2, "path": 2}


def streets(ppm: float = 3.0):
    root = ET.parse(OUT / "osm.xml").getroot()
    b = root.find("bounds")
    w, s, e, n = (float(b.get(k)) for k in ("minlon", "minlat", "maxlon", "maxlat"))
    (x0, y0), (x1, y1) = m(s, w), m(n, e)
    W, H = int((x1 - x0) * ppm), int((y1 - y0) * ppm)
    nodes = {nd.get("id"): (float(nd.get("lat")), float(nd.get("lon"))) for nd in root.iter("node")}
    px = lambda ll: ((m(*ll)[0] - x0) * ppm, (y1 - m(*ll)[1]) * ppm)
    ways = []
    for wy in root.iter("way"):
        tags = {t.get("k"): t.get("v") for t in wy.iter("tag")}
        pts = [nodes[r.get("ref")] for r in wy.iter("nd") if r.get("ref") in nodes]
        if len(pts) >= 2:
            ways.append((tags, pts))
    im = Image.new("RGB", (W, H), ST["bg"])
    d = ImageDraw.Draw(im)
    green = {"park", "grass", "garden", "meadow", "recreation_ground", "pitch", "forest", "wood", "orchard", "farmland", "cemetery", "village_green"}
    for tags, pts in ways:  # areas first
        closed = pts[0] == pts[-1] and len(pts) > 3
        if not closed:
            continue
        kind = tags.get("landuse") or tags.get("leisure") or tags.get("natural")
        if kind in green:
            d.polygon([px(p) for p in pts], fill=ST["land_green"])
        elif kind == "water" or "water" in tags:
            d.polygon([px(p) for p in pts], fill=ST["water"])
    for tags, pts in ways:
        if "building" in tags and pts[0] == pts[-1]:
            d.polygon([px(p) for p in pts], fill=ST["building"], outline=ST["building_line"])
        if tags.get("waterway"):
            d.line([px(p) for p in pts], fill=ST["water"], width=int(6 * ppm))
    order = ["track", "path", "footway", "service", "living_street", "residential", "unclassified", "tertiary", "secondary_link", "secondary", "primary"]
    roads = [(tags, pts) for tags, pts in ways if tags.get("highway") in WIDTH_M]
    roads.sort(key=lambda r: order.index(r[0]["highway"]) if r[0]["highway"] in order else 0)
    for casing in (True, False):
        for tags, pts in roads:
            hw = tags["highway"]
            major = hw in ("primary", "secondary", "secondary_link", "tertiary")
            wpx = WIDTH_M[hw] * ppm + (3 * ppm if casing else 0)
            col = (ST["major_casing"] if major else ST["casing"]) if casing else (ST["major"] if major else ST["road"])
            xy = [px(p) for p in pts]
            d.line(xy, fill=col, width=max(1, int(wpx)), joint="curve")
            r = wpx / 2
            for x, y in (xy[0], xy[-1]):
                d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    im = im.filter(ImageFilter.SMOOTH)
    im.save(OUT / "streets.png", optimize=True)
    print("streets.png", im.size)

    # the road in front of the clinic: the north-south secondary road nearest the pin (OSM leaves it unnamed;
    # the name "Commissioner Road" comes from the owner). Joined into one polyline, clipped to +-650 m north/south.
    cand = []
    for tags, pts in ways:
        if tags.get("highway") != "secondary":
            continue
        xy = [m(*p) for p in pts]
        dmin = min(math.hypot(x, y) for x, y in xy)
        dx, dy = xy[-1][0] - xy[0][0], xy[-1][1] - xy[0][1]
        if abs(dy) > abs(dx) and dmin < 400:
            cand.append(xy)
    seg = sorted({(round(x, 1), round(y, 1)) for xy in cand for x, y in xy}, key=lambda p: -p[1])
    seg = [p for p in seg if -650 <= p[1] <= 650]
    # road x at the pin's latitude -> which side the clinic is on
    a = max((p for p in seg if p[1] >= 0), key=lambda p: -p[1]); b = max((p for p in seg if p[1] < 0), key=lambda p: p[1])
    near = (round(a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]), 1), 0.0)
    # road network for the 3D drone scene (src/three/realcity.ts): every highway within 900 m, metres, 1 decimal
    net = []
    for tags, pts in roads:
        xy = [[round(v, 1) for v in m(*p)] for p in pts]
        if min(math.hypot(x, y) for x, y in xy) < 900:
            net.append({"hw": tags["highway"], "pts": xy})
    (ROOT / "src/data/realroads.json").write_text(json.dumps({"source": "© OpenStreetMap contributors (ODbL)", "ways": net}, separators=(",", ":")))
    print("3D road ways:", len(net))
    return {"src": "footage/realmap/streets.png", "bounds": [x0, y0, x1, y1]}, seg, near


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    w, s, e, n = 58.0, 22.0, 82.0, 39.0  # pakistan.jpg (GIBS BlueMarble_ShadedRelief_Bathymetry)
    (bx0, by0), (bx1, by1) = m(s, w), m(n, e)
    ow, os_, oe, on = 59.0, 22.5, 82.0, 38.5  # src/data/pakistan-map.json window (Natural Earth outline)
    (ox0, oy0), (ox1, oy1) = m(os_, ow), m(on, oe)
    layers = {"bluemarble": {"src": "footage/realmap/pakistan.jpg", "bounds": [bx0, by0, bx1, by1]},
              "outline": {"bounds": [ox0, oy0, ox1, oy1]}}
    if "--skip-s2" not in sys.argv:
        layers["s2wide"] = s2(30000, 40, "s2-wide.jpg")
        layers["s2city"] = s2(6200, 10, "s2-city.jpg")
    else:
        old = json.loads((ROOT / "src/data/realmap.json").read_text())["layers"]
        layers["s2wide"], layers["s2city"] = old["s2wide"], old["s2city"]
    layers["streets"], road, near = streets()
    data = {
        "source": "make_realmap.py",
        "pin": [0, 0],
        "road": road,
        "road_x_at_pin": near[0],
        "layers": layers,
        "credits": ["NASA Blue Marble", f"Contains modified Copernicus Sentinel data ({S2_DATE[:4]})", "© OpenStreetMap contributors"],
    }
    (ROOT / "src/data/realmap.json").write_text(json.dumps(data, indent=1))
    print("road points", len(road), "road x at pin", near)


if __name__ == "__main__" and "--pyramid" not in sys.argv:
    main()


# ---- earth zoom pyramid (owner T28: one continuous zoom; every level colour-matched into one family) -------------------------
def stac_items(bbox, start="2026-10-01", end="2026-11-25", cloud=5):
    import urllib.request
    body = json.dumps({"collections": ["sentinel-2-l2a"], "bbox": bbox, "datetime": f"{start}T00:00:00Z/{end}T23:59:59Z",
                       "query": {"eo:cloud_cover": {"lt": cloud}}, "limit": 200}).encode()
    req = urllib.request.Request("https://earth-search.aws.element84.com/v1/search", data=body, headers={"Content-Type": "application/json"})
    feats = json.load(urllib.request.urlopen(req))["features"]
    # newest first, fuller tiles first
    # the 22 Nov 2026 pass first (same pass as s2-wide/s2-city), then newest clear scenes to fill holes
    feats.sort(key=lambda f: (f["properties"]["datetime"][:10] == S2_DATE, f["properties"]["datetime"][:10],
                              -f["properties"].get("s2:nodata_pixel_percentage", 0)), reverse=True)
    return feats


def s2_mosaic(half_m: float, res: float, name: str, overview: int):
    """Sentinel-2 true colour over a large square, read from COG overviews, holes filled by older clear scenes, each scene
    colour-matched to what is already in the mosaic."""
    import rasterio
    from rasterio.warp import reproject, transform, Resampling
    from rasterio.transform import from_origin
    dlat, dlon = half_m / KY, half_m / KX
    feats = stac_items([LON0 - dlon, LAT0 - dlat, LON0 + dlon, LAT0 + dlat])
    n = int(round(2 * half_m / res))
    dst = np.zeros((3, n, n), np.float32)
    env = dict(GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif", CURL_CA_BUNDLE="/root/.ccr/ca-bundle.crt",
               GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR")
    crs = "EPSG:32643"
    xs, ys = transform("EPSG:4326", crs, [LON0], [LAT0])
    dt = from_origin(xs[0] - half_m, ys[0] + half_m, res, res)
    with rasterio.Env(**env):
        for f in feats:
            if (dst.sum(0) == 0).mean() < 0.002:
                break
            url = f["assets"]["visual"]["href"]
            try:
                src = rasterio.open("/vsicurl/" + url, overview_level=overview)
            except Exception as e:  # noqa: BLE001
                print("skip", f["id"], e); continue
            with src:
                part = np.zeros((3, n, n), np.float32)
                for b in range(3):
                    reproject(rasterio.band(src, b + 1), part[b], dst_transform=dt, dst_crs=crs, resampling=Resampling.average,
                              src_nodata=0, dst_nodata=0)
            have, new = dst.sum(0) > 0, part.sum(0) > 0
            both = have & new
            if both.sum() > 500:
                for b in range(3):
                    a, c = np.polyfit(part[b][both], dst[b][both], 1)
                    part[b] = np.where(new, np.clip(a * part[b] + c, 1, 255), 0)
            hole = ~have & new
            dst[:, hole] = part[:, hole]
            print(f["id"], "filled", int(hole.sum()), "left", int((dst.sum(0) == 0).sum()))
    img = Image.fromarray(np.moveaxis(dst.clip(0, 255).astype(np.uint8), 0, -1))
    img.save(OUT / name, quality=92)
    return {"src": f"footage/realmap/{name}", "bounds": [-half_m, -half_m, half_m, half_m]}


def match_to(img: Image.Image, ref: Image.Image, k: float = 0.6) -> Image.Image:
    """Pull img's average colour part of the way (k) towards ref's over the same ground: per-channel gain in linear light.
    (Gentle on purpose: full statistics transfer compounded into colour casts along the chain.)"""
    a = (np.asarray(img.convert("RGB")).astype(np.float32) / 255) ** 2.2
    r = (np.asarray(ref.convert("RGB").resize(img.size)).astype(np.float32) / 255) ** 2.2
    gain = (r.reshape(-1, 3).mean(0) / np.maximum(a.reshape(-1, 3).mean(0), 1e-4)) ** k
    out = np.clip(a * gain, 0, 1) ** (1 / 2.2) * 255
    return Image.fromarray(out.astype(np.uint8))


def crop_bounds(img: Image.Image, bounds, want):
    """crop the part of img (covering `bounds` in local metres) that covers `want`"""
    x0, y0, x1, y1 = bounds
    W, H = img.size
    px = lambda x: (x - x0) / (x1 - x0) * W
    py = lambda y: (y1 - y) / (y1 - y0) * H
    return img.crop((int(px(want[0])), int(py(want[3])), int(px(want[2])), int(py(want[1]))))


def pyramid():
    """earth-zoom levels: globe (world.jpg) → pakistan.jpg → s2-160 (160 km) → s2-wide (60 km) → s2-city (12.4 km), every finer level
    Lab-matched to the coarser one over the same ground so the whole zoom reads as one picture."""
    data = json.loads((ROOT / "src/data/realmap.json").read_text())
    L = data["layers"]
    L["s2_160"] = s2_mosaic(80000, 160, "s2-160.jpg", overview=2)
    pk = Image.open(OUT / "pakistan.jpg")
    chain = [("pakistan.jpg", L["bluemarble"]["bounds"]), ("s2-160.jpg", L["s2_160"]["bounds"]),
             ("s2-wide.jpg", L["s2wide"]["bounds"]), ("s2-city.jpg", L["s2city"]["bounds"])]
    (OUT / "matched").mkdir(exist_ok=True)
    pk.save(OUT / "matched/pakistan.jpg", quality=92)
    prev_img, prev_b = pk, chain[0][1]
    for name, b in chain[1:]:
        img = Image.open(OUT / name)
        ref = crop_bounds(prev_img, prev_b, b)
        m = match_to(img, ref)
        m.save(OUT / f"matched/{name}", quality=92)
        print("matched", name)
        prev_img, prev_b = m, b
    data["layers"] = L
    data["pyramid"] = [{"src": f"footage/realmap/matched/{n}", "bounds": b} for n, b in chain]
    (ROOT / "src/data/realmap.json").write_text(json.dumps(data, indent=1))


if __name__ == "__main__" and "--pyramid" in sys.argv:
    pyramid()
