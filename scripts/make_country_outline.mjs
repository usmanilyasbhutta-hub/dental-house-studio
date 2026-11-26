// Pakistan + neighbours outline for the promo's own map, from Natural Earth (public domain) via the world-atlas package.
// Projected once here (equirectangular, x scaled by cos 30°) into a small JSON of SVG paths in a 1000-wide box.
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));
const all = feature(topo, topo.objects.countries).features;
const want = { "586": "Pakistan", "356": "India", "004": "Afghanistan", "364": "Iran", "156": "China" };
const [lon0, lon1, lat0, lat1] = [59, 82, 22.5, 38.5]; // view window around Pakistan
const k = Math.cos((30 * Math.PI) / 180);
const W = 1000, H = Math.round(((lat1 - lat0) / ((lon1 - lon0) * k)) * W);
const px = (lon, lat) => [((lon - lon0) * k) / ((lon1 - lon0) * k) * W, ((lat1 - lat) / (lat1 - lat0)) * H];
const ring = (r) => "M" + r.map(([lo, la]) => px(lo, la).map((v) => v.toFixed(1)).join(",")).join("L") + "Z";
const paths = {};
for (const f of all) {
  const id = String(f.id).padStart(3, "0");
  if (!want[id]) continue;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  paths[want[id]] = polys.map((p) => ring(p[0])).join("");
}
const sialkot = px(74.5365, 32.4945).map((v) => +v.toFixed(1));
writeFileSync("src/data/pakistan-map.json", JSON.stringify({ source: "Natural Earth (public domain) via world-atlas", width: W, height: H, paths, sialkot }));
console.log("countries:", Object.keys(paths).join(", "), "size", W, H, "sialkot", sialkot);
