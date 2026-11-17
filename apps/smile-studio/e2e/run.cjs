#!/usr/bin/env node
// Smile Studio end-to-end suite (Playwright, preinstalled Chromium; no browser downloads).
// Run: npm run e2e          (from apps/smile-studio)
// Env: E2E_PORT (5184, vite dev), E2E_PREVIEW_PORT (5185, built app), E2E_DEVICES ("iPhone 13,Pixel 7,iPad (gen 7) landscape"),
//      E2E_SKIP_OFFLINE=1, E2E_HEADED=1.
// The test face is SYNTHETIC (e2e/make_face.py). Never point this at patient photos.
// Artefacts: e2e/.tmp/ (face.jpg, shots/, exports/, report.json). Gitignored.
"use strict";
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

function req(name) {
  for (const p of [undefined, "/opt/node-tools/node_modules", "/usr/local/lib/node_modules_global", "/opt/node22/lib/node_modules"]) {
    try {
      return p ? require(require.resolve(name, { paths: [p] })) : require(name);
    } catch {}
  }
  throw new Error(`Cannot find ${name}. Playwright must be preinstalled (do not install browsers).`);
}
const { chromium, devices } = req("playwright");

const APP = path.resolve(__dirname, "..");
const TMP = path.join(__dirname, ".tmp");
const SHOTS = path.join(TMP, "shots");
const EXPORTS = path.join(TMP, "exports");
const PORT = Number(process.env.E2E_PORT || 5184);
const PPORT = Number(process.env.E2E_PREVIEW_PORT || 5185);
const DEVICES = (process.env.E2E_DEVICES || "iPhone 13,Pixel 7,iPad (gen 7) landscape").split(",").map((s) => s.trim());
const IMG = { w: 1200, h: 1600 };
const VITE = path.join(APP, "node_modules", ".bin", "vite");

const results = [];
const servers = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

// ---------- servers ----------
function waitHttp(url, ms = 30000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () =>
      http
        .get(url, (r) => {
          r.resume();
          resolve();
        })
        .on("error", () => (Date.now() - t0 > ms ? reject(new Error(`timeout waiting for ${url}`)) : setTimeout(tick, 250)));
    tick();
  });
}
async function startServer(args, port) {
  const p = spawn(VITE, [...args, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: APP,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let log = "";
  p.stdout.on("data", (d) => (log += d));
  p.stderr.on("data", (d) => (log += d));
  servers.push(p);
  try {
    await waitHttp(`http://127.0.0.1:${port}/`);
  } catch (e) {
    throw new Error(`${e.message}\n${log.slice(-2000)}`);
  }
  return p;
}
function stopServer(p) {
  if (!p || p.exitCode !== null) return;
  try {
    process.kill(-p.pid, "SIGTERM");
  } catch {}
}
const stopAll = () => servers.forEach(stopServer);
process.on("exit", stopAll);
process.on("SIGINT", () => process.exit(130));

// ---------- test plumbing ----------
async function test(device, name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ device, name, ok: true, note: note || "", ms: Date.now() - t0 });
    console.log(`  PASS  ${name}${note ? `  (${note})` : ""}`);
  } catch (e) {
    results.push({ device, name, ok: false, note: String(e && e.message ? e.message : e), ms: Date.now() - t0 });
    console.log(`  FAIL  ${name}\n        ${String(e && e.message ? e.message : e).split("\n").join("\n        ")}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------- page helpers ----------
const IDB_READ = async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open("smile-studio", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("cases", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const all = await new Promise((res, rej) => {
    const r = db.transaction("cases", "readonly").objectStore("cases").getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return all
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ photo, thumb, ...rest }) => ({ ...rest, hasThumb: !!thumb, photoType: photo && photo.type }));
};
const cases = (page) => page.evaluate(IDB_READ);
async function current(page) {
  const all = await cases(page);
  assert(all.length > 0, "no case in IndexedDB");
  return all[0];
}

/** Mirrors Stage.tsx view maths so we can find handles on screen without app hooks. */
async function view(page, step, c) {
  const r = await page.locator(".stage canvas").boundingBox();
  let s, ox, oy;
  if (step === "guides" || step === "compare") {
    s = Math.min(r.width / c.imgW, r.height / c.imgH);
    ox = (r.width - c.imgW * s) / 2;
    oy = (r.height - c.imgH * s) / 2;
  } else {
    const d = c.design;
    s = Math.min(r.width / (d.width * 1.6), r.height / (d.width * 0.95), 8);
    ox = r.width / 2 - d.center.x * s;
    oy = r.height * 0.5 - (d.center.y - d.width * 0.12) * s;
  }
  return { r, s, ox, oy, scr: (p) => ({ x: r.x + ox + p.x * s, y: r.y + oy + p.y * s }) };
}
/** Design handles in image coords, using the app's own pure geometry module (vite dev serves it). */
const handles = (page, c) =>
  page.evaluate(async (c) => {
    const g = await import("/src/geometry.ts");
    const a = g.designAngle(c.design, c.guides);
    const L = g.centralLength(c.design);
    const h = g.designHandles(c.design, a);
    return { ...h, toothMid: g.toImage({ x: g.centralWidth(c.design) * 0.5, y: -L * 0.5 }, c.design, a) };
  }, c);

// Real touch input through CDP (pointerType "touch", like a phone).
async function touch(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 4, radiusY: 4, force: 1 })) });
  return {
    async drag(a, b, steps = 8) {
      await send("touchStart", [a]);
      for (let i = 1; i <= steps; i++) await send("touchMove", [{ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }]);
      await send("touchEnd", []);
    },
    async pinch(c, d0, d1, steps = 8, firstAt) {
      const A = firstAt || { x: c.x - d0 / 2, y: c.y };
      const B = { x: 2 * c.x - A.x, y: 2 * c.y - A.y };
      await send("touchStart", [{ ...A, id: 1 }, { ...B, id: 2 }]);
      for (let i = 1; i <= steps; i++) {
        const k = (d0 + ((d1 - d0) * i) / steps) / d0;
        await send("touchMove", [
          { x: c.x + (A.x - c.x) * k, y: c.y + (A.y - c.y) * k, id: 1 },
          { x: c.x + (B.x - c.x) * k, y: c.y + (B.y - c.y) * k, id: 2 },
        ]);
      }
      // lift one finger, then the other (this is how fingers really leave the glass)
      const kk = d1 / d0;
      await send("touchEnd", [{ x: c.x + (B.x - c.x) * kk, y: c.y + (B.y - c.y) * kk, id: 2 }]);
      await send("touchEnd", []);
    },
  };
}
/** Average RGB of the on-screen canvas around a page-coordinate point. */
const pixel = (page, p) =>
  page.evaluate((p) => {
    const cv = document.querySelector(".stage canvas");
    const r = cv.getBoundingClientRect();
    const k = cv.width / r.width;
    const d = cv.getContext("2d").getImageData(Math.round((p.x - r.left) * k) - 2, Math.round((p.y - r.top) * k) - 2, 5, 5).data;
    const s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) s[j] += d[i + j];
    return s.map((v) => Math.round(v / (d.length / 4)));
  }, p);
const cdiff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const canvasHash = (page) =>
  page.evaluate(() => {
    const cv = document.querySelector(".stage canvas");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0;
    return h;
  });

async function gotoStep(page, label) {
  await page.getByRole("navigation", { name: "Design steps" }).getByRole("button", { name: new RegExp(label) }).click();
  await page.waitForTimeout(150);
}
async function importPhoto(page, file) {
  await page.locator('input[type="file"]:not([capture])').setInputFiles(file);
  await page.locator(".topbar .title .h").waitFor();
  await page.waitForFunction(() => !document.querySelector(".stage.loading"));
  await page.waitForTimeout(200);
}

// Stub the share sheet so exports can be captured (phones take this path; Chromium desktop has no share()).
const SHARE_STUB = () => {
  window.__shared = [];
  navigator.canShare = () => true;
  navigator.share = async (data) => {
    window.__shared.push(...(data.files || []));
  };
};

// ---------- device suite ----------
async function deviceSuite(browser, devName, face) {
  const { defaultBrowserType, ...dev } = devices[devName];
  const ctx = await browser.newContext({ ...dev });
  await ctx.addInitScript(SHARE_STUB);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${slug(devName)}-${n}.png`) });
  const base = `http://127.0.0.1:${PORT}/`;
  const T = await touch(page);
  console.log(`\n# ${devName} (${dev.viewport.width}x${dev.viewport.height}, dpr ${dev.deviceScaleFactor})`);

  await test(devName, "import photo", async () => {
    await page.goto(base);
    await page.getByRole("heading", { name: /Design the smile/ }).waitFor();
    await importPhoto(page, face);
    const c = await current(page);
    assert(c.imgW === IMG.w && c.imgH === IMG.h, `stored size ${c.imgW}x${c.imgH}`);
    assert(c.photoType === "image/jpeg", `photo re-encoded as ${c.photoType}`);
    assert((await page.locator(".topbar .title .h").textContent()) === "Face", "editor did not open on Face");
    await shot("01-face");
    return `${c.imgW}x${c.imgH} jpeg`;
  });

  await test(devName, "each step opens with its controls, layout fits viewport", async () => {
    const expect = [
      ["Face", "01", /Pupil line/i],
      ["Lips", "02", /Reset lip line/i],
      ["Teeth", "03", /Central width \/ length/i],
      ["Shade", "04", /Blend with photo/i],
      ["Compare", "05", /Share side by side/i],
    ];
    const vp = page.viewportSize();
    for (const [label, n, re] of expect) {
      await gotoStep(page, label);
      assert((await page.locator(".topbar .title .h").textContent()) === label, `title not ${label}`);
      assert((await page.locator(".topbar .title .mono").textContent()).startsWith(n), `counter not ${n}`);
      assert(re.test(await page.locator(".panel").innerText()), `${label} panel missing ${re}`);
      const cur = page.locator('.steps [aria-current="true"]');
      assert((await cur.count()) === 1 && (await cur.innerText()).toLowerCase().includes(label.toLowerCase()), `aria-current not on ${label}`);
      const nav = await page.locator(".steps").boundingBox();
      assert(nav.y + nav.height <= vp.height + 1, `${label}: step bar off screen (bottom ${Math.round(nav.y + nav.height)} > ${vp.height})`);
      const st = await page.locator(".stage").boundingBox();
      assert(st.height >= 200, `${label}: stage only ${Math.round(st.height)} px tall`);
      await shot(`02-step-${n}-${slug(label)}`);
    }
    await gotoStep(page, "Face");
  });

  await test(devName, "Face: dragging a pupil handle moves it and updates the pupil-line read-out", async () => {
    await gotoStep(page, "Face");
    const c0 = await current(page);
    const v = await view(page, "guides", c0);
    const before = await page.locator(".panel .small").innerText();
    const a = v.scr(c0.guides.pupilR);
    await T.drag(a, { x: a.x + 6, y: a.y + 24 });
    await page.waitForTimeout(800);
    const c1 = await current(page);
    const dy = c1.guides.pupilR.y - c0.guides.pupilR.y;
    assert(near(dy, 24 / v.s, 3), `pupilR moved ${dy.toFixed(1)} img px, expected ~${(24 / v.s).toFixed(1)}`);
    const after = await page.locator(".panel .small").innerText();
    assert(after !== before, `read-out unchanged: "${after}"`);
    return `${before} -> ${after}`;
  });

  await test(devName, "Lips: dragging a lip dot moves only that dot", async () => {
    await gotoStep(page, "Lips");
    const c0 = await current(page);
    const v = await view(page, "lips", c0);
    const a = v.scr(c0.lips[0]);
    await T.drag(a, { x: a.x - 15, y: a.y });
    await page.waitForTimeout(800);
    const c1 = await current(page);
    const moved = c1.lips.map((p, i) => Math.hypot(p.x - c0.lips[i].x, p.y - c0.lips[i].y) > 0.5);
    assert(moved[0] && moved.filter(Boolean).length === 1, `moved dots: ${moved.map((m, i) => (m ? i : "")).filter(String).join(",") || "none"}`);
  });

  await test(devName, "Teeth: width / length / move handles change the read-out", async () => {
    await gotoStep(page, "Teeth");
    const c0 = await current(page);
    const v = await view(page, "design", c0);
    const h = await handles(page, c0);
    const ro = () => page.locator(".readout").innerText();
    const r0 = await ro();
    const wR = v.scr(h.widthR);
    await T.drag(wR, { x: wR.x + 25, y: wR.y });
    await page.waitForTimeout(700);
    const r1 = await ro();
    const c1 = await current(page);
    assert(c1.design.width > c0.design.width + 1, `width ${c0.design.width.toFixed(1)} -> ${c1.design.width.toFixed(1)}`);
    assert(/Central [^\n]*/i.exec(r1)[0] !== /Central [^\n]*/i.exec(r0)[0], `Central read-out unchanged: ${r1}`);
    const h1 = await handles(page, c1);
    const len = v.scr(h1.length);
    await T.drag(len, { x: len.x, y: len.y - 20 });
    await page.waitForTimeout(700);
    const r2 = await ro();
    const c2 = await current(page);
    assert(c2.design.wl !== c1.design.wl, `wl unchanged ${c2.design.wl}`);
    assert(/W\/L \d+%/i.exec(r2)[0] !== /W\/L \d+%/i.exec(r1)[0], `W/L read-out unchanged: ${r2}`);
    const h2 = await handles(page, c2);
    const mv = v.scr(h2.move);
    await T.drag(mv, { x: mv.x + 12, y: mv.y });
    await page.waitForTimeout(700);
    const c3 = await current(page);
    assert(c3.design.center.x > c2.design.center.x + 1, "move handle did not move the design");
    await shot("03-teeth-dragged");
    return `${r0.replace(/\n/g, " ")} => ${(await ro()).replace(/\n/g, " ")}`;
  });

  await test(devName, "pinch-zoom and wheel zoom never move handles", async () => {
    await gotoStep(page, "Face");
    const c0 = await current(page);
    const v = await view(page, "guides", c0);
    const h0 = await canvasHash(page);
    // 1) pinch on empty photo area
    const mid = { x: v.r.x + v.r.width / 2, y: v.r.y + v.r.height * 0.85 };
    await T.pinch(mid, 60, 160);
    await page.waitForTimeout(700);
    const c1 = await current(page);
    const h1 = await canvasHash(page);
    assert(h1 !== h0, "pinch did not zoom (canvas unchanged)");
    assert(JSON.stringify(c1.guides) === JSON.stringify(c0.guides), "guides changed during empty-area pinch");
    // 2) pinch where the first finger lands ON a handle (common on a phone)
    await page.locator(".fab.fit").click();
    await page.waitForTimeout(200);
    const pr = v.scr(c0.guides.pupilR);
    const c2a = await current(page);
    const cdp = await page.context().newCDPSession(page);
    const B = { x: pr.x + 120, y: pr.y + 120 };
    const tp = (a, b) => [
      { x: a.x, y: a.y, id: 1 },
      { x: b.x, y: b.y, id: 2 },
    ];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(pr, B) });
    for (let i = 1; i <= 8; i++)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp({ x: pr.x - 5 * i, y: pr.y - 5 * i }, { x: B.x + 5 * i, y: B.y + 5 * i }) });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ x: B.x + 40, y: B.y + 40, id: 2 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(700);
    const c2 = await current(page);
    const dd = Math.hypot(c2.guides.pupilR.x - c2a.guides.pupilR.x, c2.guides.pupilR.y - c2a.guides.pupilR.y);
    assert(dd < 0.5, `pupil handle moved ${dd.toFixed(1)} img px when a pinch started on it`);
    // 3) wheel zoom
    await page.locator(".fab.fit").click();
    await page.mouse.move(v.r.x + v.r.width / 2, v.r.y + v.r.height / 2);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(600);
    const c3 = await current(page);
    assert(JSON.stringify(c3.guides) === JSON.stringify(c2.guides), "guides changed on wheel zoom");
    await page.locator(".fab.fit").click();
  });

  await test(devName, "Compare: slider reveals now vs simulation; Hold: before hides teeth", async () => {
    await gotoStep(page, "Compare");
    const c = await current(page);
    const v = await view(page, "compare", c);
    const h = await handles(page, c);
    const tp = v.scr(h.toothMid);
    const y = v.r.y + v.r.height * 0.15;
    // divider far left -> simulation everywhere right of it
    await T.drag({ x: v.r.x + v.r.width * 0.5, y }, { x: v.r.x + 4, y });
    await page.waitForTimeout(150);
    const sim = await pixel(page, tp);
    await shot("05-compare-left");
    // divider far right -> photo
    await T.drag({ x: v.r.x + 4, y }, { x: v.r.x + v.r.width - 4, y });
    await page.waitForTimeout(150);
    const now = await pixel(page, tp);
    await shot("05-compare-right");
    assert(cdiff(sim, now) > 25, `tooth pixel same either side of divider: sim ${sim} now ${now}`);
    await T.drag({ x: v.r.x + v.r.width - 4, y }, { x: v.r.x + 4, y });
    await page.waitForTimeout(150);
    const hold = page.getByRole("button", { name: /Hold to see the original/ });
    const hb = await hold.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    const held = await pixel(page, tp);
    await page.mouse.up();
    assert(cdiff(held, now) < 25, `Hold: before still shows teeth: ${held} vs photo ${now}`);
    return `sim ${sim} / photo ${now}`;
  });

  await test(devName, "export: PNG sizes, label band, legible label", async () => {
    await gotoStep(page, "Compare");
    const out = [];
    for (const [btn, cols] of [
      ["Share simulation", 1],
      ["Share side by side", 2],
    ]) {
      await page.evaluate(() => (window.__shared = []));
      await page.getByRole("button", { name: btn, exact: true }).click();
      await page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 15000 });
      const info = await page.evaluate(async () => {
        const f = window.__shared[0];
        const bmp = await createImageBitmap(f);
        const cv = document.createElement("canvas");
        cv.width = bmp.width;
        cv.height = bmp.height;
        const ctx = cv.getContext("2d");
        ctx.drawImage(bmp, 0, 0);
        const W = bmp.width;
        const H = bmp.height;
        const band = Math.round(Math.max(1200, 1600) * 0.05);
        const row = ctx.getImageData(0, H - band, W, band).data;
        // columns in the band that hold text (anything clearly lighter than slateDeep #1C2220)
        const ink = new Array(W).fill(false);
        for (let yy = 0; yy < band; yy++)
          for (let x = 0; x < W; x++) {
            const i = (yy * W + x) * 4;
            if (row[i] + row[i + 1] + row[i + 2] > 3 * 90) ink[x] = true;
          }
        let gaps = 0, run = 0, maxGap = 0, first = ink.indexOf(true), last = ink.lastIndexOf(true);
        for (let x = first; x <= last; x++) {
          if (!ink[x]) run++;
          else {
            maxGap = Math.max(maxGap, run);
            run = 0;
          }
        }
        // where the two strings sit, measured with the app's own fonts
        await document.fonts.load('700 20px "Oswald"');
        await document.fonts.load('500 20px "JetBrains Mono"');
        const pad = Math.round(1200 * 0.02);
        const fs = Math.round(band * 0.3);
        ctx.font = `500 ${fs}px "JetBrains Mono", monospace`;
        const wm = ctx.measureText("SMILE SIMULATION · FOR DISCUSSION ONLY · NOT A TREATMENT RESULT").width;
        ctx.font = `700 ${Math.round(fs * 1.25)}px Oswald, sans-serif`;
        const brand = ctx.measureText("DENTAL HOUSE · SIALKOT").width;
        const corner = ctx.getImageData(1, H - 2, 1, 1).data;
        const png = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(f); });
        return { png, name: f.name, type: f.type, W, H, band, inkFirst: first, inkLast: last, maxGap, leftEnd: pad + wm, rightStart: W - pad - brand, corner: [...corner].slice(0, 3) };
      });
      fs.writeFileSync(path.join(EXPORTS, `${slug(devName)}-${info.name}`), Buffer.from(info.png, "base64"));
      delete info.png;
      fs.writeFileSync(path.join(EXPORTS, `${slug(devName)}-${cols}.json`), JSON.stringify(info, null, 2));
      const eW = cols === 1 ? IMG.w : IMG.w * 2 + Math.round(IMG.w * 0.02);
      const eH = IMG.h + Math.round(Math.max(IMG.w, IMG.h) * 0.05);
      assert(info.type === "image/png" && /\.png$/.test(info.name), `not a png: ${info.name} ${info.type}`);
      assert(info.W === eW && info.H === eH, `${btn}: ${info.W}x${info.H}, expected ${eW}x${eH}`);
      assert(cdiff(info.corner, [0x1c, 0x22, 0x20]) < 6, `${btn}: band colour ${info.corner}`);
      assert(info.inkFirst >= 0, `${btn}: label band is empty`);
      assert(
        // measured on the PNG itself: the two texts in the band must be separated by a clear gap (or wrapped)
        info.maxGap >= 24,
        `${btn}: label band text has no clear gap (largest gap ${info.maxGap}px) on a ${info.W}px-wide export`,
      );
      out.push(`${info.W}x${info.H}`);
    }
    return out.join(", ");
  });

  await test(devName, "autosave: edits survive a reload (after 1 s)", async () => {
    await gotoStep(page, "Face");
    const c0 = await current(page);
    const v = await view(page, "guides", c0);
    const a = v.scr(c0.guides.midline);
    await T.drag(a, { x: a.x + 15, y: a.y });
    await page.waitForTimeout(1000);
    const want = (await current(page)).guides.midline;
    assert(Math.abs(want.x - c0.guides.midline.x) > 1, "midline drag did not register");
    await page.reload();
    await page.getByRole("heading", { name: /Design the smile/ }).waitFor();
    await page.locator(".card-open").first().waitFor();
    await page.locator(".card-open").first().click();
    await page.locator(".topbar .title .h").waitFor();
    const c1 = await current(page);
    assert(near(c1.guides.midline.x, want.x, 0.01), `midline ${c1.guides.midline.x} != saved ${want.x}`);
  });

  await test(devName, "autosave: an edit made just before the page is closed is kept", async () => {
    const c0 = await current(page);
    const v = await view(page, "guides", c0);
    const a = v.scr(c0.guides.pupilL);
    await T.drag(a, { x: a.x, y: a.y + 20 });
    await page.waitForTimeout(150); // user switches app / phone kills tab within the 500 ms debounce
    await page.reload();
    await page.getByRole("heading", { name: /Design the smile/ }).waitFor();
    const c1 = (await cases(page))[0];
    assert(c1.guides.pupilL.y > c0.guides.pupilL.y + 1, `pupilL edit lost on reload (y ${c0.guides.pupilL.y.toFixed(1)} -> ${c1.guides.pupilL.y.toFixed(1)})`);
  });

  await test(devName, "case card shows a thumbnail after the app is reloaded mid-edit", async () => {
    await page.goto(base);
    await page.locator(".card").first().waitFor();
    const hasImg = await page.locator(".card-open img").count();
    assert(hasImg > 0, "case card has no thumbnail (thumb is only written by '‹ Cases', never by autosave)");
  });

  await test(devName, "back to cases, delete (cancel keeps it, OK removes it)", async () => {
    await page.goto(base);
    await page.locator(".card-open").first().click();
    await page.locator(".topbar .title .h").waitFor();
    await page.getByRole("button", { name: "Back to cases" }).click();
    await page.locator(".card").first().waitFor();
    assert((await page.locator(".card-open img").count()) === 1, "no thumbnail after ‹ Cases");
    await shot("06-home-with-case");
    const n0 = (await cases(page)).length;
    page.once("dialog", (d) => d.dismiss());
    await page.locator(".card-del").first().click();
    await page.waitForTimeout(300);
    assert((await cases(page)).length === n0, "cancel deleted the case");
    page.once("dialog", (d) => d.accept());
    await page.locator(".card-del").first().click();
    await page.waitForTimeout(500);
    assert((await cases(page)).length === n0 - 1, "OK did not delete the case");
    assert((await page.locator(".card").count()) === n0 - 1, "card still listed after delete");
    if (n0 === 1) assert(/No designs yet/.test(await page.locator(".cases").innerText()), "empty-state text missing");
  });

  const jsErr = errors.filter((e) => !/favicon/.test(e));
  await test(devName, "no JS errors in console", async () => {
    assert(jsErr.length === 0, jsErr.slice(0, 5).join("\n"));
  });
  await ctx.close();
}

// ---------- offline (built app + service worker) ----------
async function offlineSuite(browser, face) {
  console.log(`\n# offline: built app on vite preview :${PPORT}`);
  const outDir = path.join(TMP, "dist");
  execFileSync(VITE, ["build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], { cwd: APP, stdio: "inherit" });
  const url = `http://127.0.0.1:${PPORT}/`;
  const { defaultBrowserType, ...dev } = devices["Pixel 7"];

  for (const [name, warmReloads] of [
    ["offline reload after the FIRST visit (install, then no signal)", 0],
    ["offline reload after a second online visit", 1],
  ]) {
    let srv = await startServer(["preview", "--outDir", outDir], PPORT);
    const ctx = await browser.newContext({ ...dev });
    const page = await ctx.newPage();
    await test("Pixel 7 (built)", name, async () => {
      await page.goto(url);
      await page.getByRole("heading", { name: /Design the smile/ }).waitFor();
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
      await page.waitForTimeout(500);
      for (let i = 0; i < warmReloads; i++) {
        await page.reload();
        await page.getByRole("heading", { name: /Design the smile/ }).waitFor();
        await page.waitForTimeout(500);
      }
      const cached = await page.evaluate(async () => {
        const out = [];
        for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
        return out;
      });
      stopServer(srv);
      await sleep(500);
      await ctx.setOffline(true);
      await page.reload().catch(() => {});
      const ok = await page
        .getByRole("heading", { name: /Design the smile/ })
        .waitFor({ timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      await page.screenshot({ path: path.join(SHOTS, `offline-${warmReloads}.png`) });
      assert(ok, `app did not load offline. Cached: ${cached.join(" ") || "(nothing)"}`);
      // import + edit still works offline
      await importPhoto(page, face);
      const fontsOk = await page.evaluate(() => document.fonts.check('600 17px "Oswald"'));
      return `cached ${cached.length} files; Oswald offline: ${fontsOk}`;
    });
    await ctx.close();
    stopServer(srv);
    await sleep(300);
  }
}

// ---------- main ----------
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.mkdirSync(EXPORTS, { recursive: true });
  const face = path.join(TMP, "face.jpg");
  execFileSync("python3", [path.join(__dirname, "make_face.py"), face, String(IMG.w), String(IMG.h)], { stdio: "ignore" });

  const browser = await chromium.launch({ headless: !process.env.E2E_HEADED });
  try {
    await startServer([], PORT);
    for (const d of DEVICES) {
      assert(devices[d], `unknown device ${d}`);
      await deviceSuite(browser, d, face);
    }
    stopAll();
    if (!process.env.E2E_SKIP_OFFLINE) await offlineSuite(browser, face);
  } finally {
    await browser.close();
    stopAll();
  }
  fs.writeFileSync(path.join(TMP, "report.json"), JSON.stringify(results, null, 2));
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed. Screenshots: e2e/.tmp/shots  Report: e2e/.tmp/report.json`);
  process.exit(fail.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  stopAll();
  process.exit(2);
});
