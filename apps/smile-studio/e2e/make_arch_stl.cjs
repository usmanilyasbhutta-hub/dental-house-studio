// SYNTHETIC lower arch STL for the wax-up tests: 14 egg-shaped "teeth" on a parabola. Never a patient scan.
// grow = mm added to the six front teeth (the "wax-up"); moved = the wax-up is exported rotated and shifted.
const fs = require("fs");
const W = [5.4, 5.9, 6.9, 7.0, 7.1, 11.2, 10.5];
function archLen(a, x) {
  const g = (u) => { const s = 2 * a * u; return (s * Math.sqrt(1 + s * s) + Math.asinh(s)) / (4 * a); };
  return g(x) - g(0);
}
function ellipsoid(out, cx, cy, cz, rx, ry, rz, seg = 16) {
  const P = (i, j) => { const th = (i / seg) * Math.PI, ph = (j / seg) * 2 * Math.PI; return [cx + rx * Math.sin(th) * Math.cos(ph), cy + ry * Math.sin(th) * Math.sin(ph), cz + rz * Math.cos(th)]; };
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) { const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1); out.push(a, b, c, a, c, d); }
}
function makeArchStl(file, { grow = 0, moved = false } = {}) {
  const v = [];
  const a = -0.02;
  for (const side of [-1, 1]) {
    let s = 0;
    for (let k = 0; k < 7; k++) {
      const cs = s + W[k] / 2; s += W[k];
      let x = 0; while (archLen(a, x) < cs) x += 0.02;
      x *= side;
      const g = k < 3 ? grow : 0;
      ellipsoid(v, x, a * x * x, 0, W[k] / 2 - 0.3 + g, 3 + g, 4 + g);
    }
  }
  const c = Math.cos(0.25), sn = Math.sin(0.25);
  const T = moved ? (p) => [p[0] + 4, c * p[1] - sn * p[2] - 3, sn * p[1] + c * p[2] + 7] : (p) => p;
  const n = v.length / 3;
  const buf = Buffer.alloc(84 + n * 50);
  buf.writeUInt32LE(n, 80);
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) { const p = T(v[t * 3 + k]); for (let q = 0; q < 3; q++) buf.writeFloatLE(p[q], 84 + t * 50 + 12 + k * 12 + q * 4); }
  fs.writeFileSync(file, buf);
}
module.exports = { makeArchStl };
