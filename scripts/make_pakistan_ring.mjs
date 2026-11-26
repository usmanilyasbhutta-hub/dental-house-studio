// Pakistan border as lon/lat rings (Natural Earth, public domain, via world-atlas) for the globe intro (DroneMap).
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));
const pk = feature(topo, topo.objects.countries).features.find((f) => String(f.id).padStart(3, "0") === "586");
const polys = pk.geometry.type === "Polygon" ? [pk.geometry.coordinates] : pk.geometry.coordinates;
const rings = polys.map((p) => p[0].map(([lo, la]) => [+lo.toFixed(3), +la.toFixed(3)])).sort((a, b) => b.length - a.length).slice(0, 1);
writeFileSync("src/data/pakistan-ring.json", JSON.stringify({ source: "Natural Earth (public domain) via world-atlas", rings }));
console.log("points", rings[0].length);
