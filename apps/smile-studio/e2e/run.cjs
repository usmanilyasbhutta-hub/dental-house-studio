#!/usr/bin/env node
// Smile Studio end-to-end suite (Playwright, preinstalled Chromium; no browser downloads).
// Run: npm run e2e          (from apps/smile-studio)
// Env: E2E_PORT (5184, vite dev), E2E_PREVIEW_PORT (5185, built app), E2E_DEVICES ("iPhone 13,Pixel 7,iPad (gen 7) landscape"),
//      E2E_SKIP_OFFLINE=1, E2E_HEADED=1, E2E_ONLY_BITE=1 (only the round-6 bite suite),
//      E2E_ONLY_LABS=1 (only the round-7 Labs suites), E2E_LABS_DEVICES ("iPhone 13,iPad (gen 7) landscape").
// Test images are SYNTHETIC: e2e/make_face.py (face) and e2e/make_bite.py (retracted bite with overbite).
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
const LABS_DEVICES = (process.env.E2E_LABS_DEVICES || "iPhone 13,iPad (gen 7) landscape").split(",").map((s) => s.trim());
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
    const r = indexedDB.open("smile-studio");
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
  if (step === "guides" || step === "compare-face") {
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
    async hold(a, ms = 650) {
      await send("touchStart", [a]);
      await new Promise((r) => setTimeout(r, ms));
      await send("touchEnd", []);
    },
    async tap(a) {
      await send("touchStart", [a]);
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
  await page.waitForFunction(() => document.querySelector(".stage canvas")?.clientWidth > 0);
  await dismissCoach(page);
  await page.waitForTimeout(200);
}
/** First-run coach sheet (once per device): dismiss it with its own button. */
async function dismissCoach(page) {
  const got = page.getByRole("button", { name: "Got it" });
  if (await got.isVisible().catch(() => false)) await got.click();
}

// Stub the share sheet so exports can be captured (phones take this path; Chromium desktop has no share()).
const SHARE_STUB = () => {
  window.__shared = [];
  navigator.canShare = () => true;
  navigator.share = async (data) => {
    window.__shared.push(...(data.files || []));
  };
  // print: record how many A4 pages were handed to the print style sheet, then behave like a closed dialog
  window.__printed = [];
  window.print = () => {
    const imgs = [...document.querySelectorAll(".print-root img")];
    window.__printed.push(imgs.map((i) => [i.naturalWidth, i.naturalHeight]));
    setTimeout(() => window.dispatchEvent(new Event("afterprint")), 0);
  };
};
/** Sizes and types of the files the app shared since the last reset. */
const sharedInfo = (page) =>
  page.evaluate(async () =>
    Promise.all(
      window.__shared.map(async (f) => {
        const b = await createImageBitmap(f);
        const png = await new Promise((r) => {
          const fr = new FileReader();
          fr.onload = () => r(String(fr.result).split(",")[1]);
          fr.readAsDataURL(f);
        });
        return { name: f.name, type: f.type, w: b.width, h: b.height, png };
      }),
    ),
  );
async function agreeIfAsked(page) {
  const agree = page.getByRole("button", { name: "Yes, patient agreed" });
  if (await agree.isVisible({ timeout: 1000 }).catch(() => false)) await agree.click();
}

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
      ["Teeth", "03", /Follow lower lip/i],
      ["Shade", "04", /Blend with photo/i],
      ["Compare", "05", /Share side by side/i],
      ["Plan", "06", /Show molars/i],
    ];
    const vp = page.viewportSize();
    for (const [label, n, re] of expect) {
      await gotoStep(page, label);
      assert((await page.locator(".topbar .title .h").textContent()) === label, `title not ${label}`);
      assert((await page.locator(".topbar .title .sub").textContent()).startsWith(`Step ${Number(n)} of 6`), `counter not step ${Number(n)} of 6`);
      assert(re.test(await page.locator(".panel").innerText()), `${label} panel missing ${re}`);
      const cur = page.locator('.steps [aria-current]');
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

  await test(devName, "Lips › Existing teeth: auto-detect saves a mask, the brush changes it, undo restores it", async () => {
    await gotoStep(page, "Lips");
    await page.getByRole("radio", { name: "Existing teeth" }).click();
    await page.getByRole("button", { name: "Auto-detect" }).click();
    await page.waitForTimeout(900);
    const c0 = await current(page);
    assert(c0.toothMask && /^data:image\/png/.test(c0.toothMask.png), "no toothMask saved after Auto-detect");
    const on = await page.evaluate(async (tm) => {
      const im = new Image();
      im.src = tm.png;
      await im.decode();
      const cv = document.createElement("canvas");
      cv.width = tm.w;
      cv.height = tm.h;
      const x = cv.getContext("2d");
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, tm.w, tm.h).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 127) n++;
      return n;
    }, c0.toothMask);
    assert(on > 50, `auto-detect found only ${on} tooth pixels on the synthetic face`);
    await shot("02b-existing-teeth");
    // paint a stroke on the upper lip (outside the detected teeth)
    const v = await view(page, "lips", c0);
    const d = c0.design;
    const a = v.scr({ x: d.center.x - d.width * 0.2, y: d.center.y - d.width * 0.3 });
    await T.drag(a, { x: a.x + 60, y: a.y });
    await page.waitForTimeout(900);
    const c1 = await current(page);
    assert(c1.toothMask.png !== c0.toothMask.png, "painting did not change the saved mask");
    assert(JSON.stringify(c1.lips) === JSON.stringify(c0.lips), "painting moved lip dots");
    await shot("02c-existing-teeth-painted");
    await page.getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(900);
    const c2 = await current(page);
    assert(c2.toothMask && c2.toothMask.png === c0.toothMask.png, "undo did not restore the mask");
    await page.getByRole("radio", { name: "Lip line" }).click();
    return `${on} px auto`;
  });

  await test(devName, "Teeth: Upper / Lower switch, lower length handle below, hint says lower incisal edges", async () => {
    await gotoStep(page, "Teeth");
    await page.getByRole("radio", { name: "Lower", exact: true }).click();
    await page.waitForTimeout(800);
    const c0 = await current(page);
    assert(c0.design.arch === "lower", `arch ${c0.design.arch}`);
    assert(/lower incisal edges/i.test(await page.locator(".panel").innerText()), "lower hint missing");
    const h = await page.evaluate(async (c) => {
      const g = await import("/src/geometry.ts");
      const st = await import("/src/Stage.tsx");
      return st.uiHandles(c.design, g.designAngle(c.design, c.guides));
    }, c0);
    assert(h.length.y > c0.design.center.y, "lower length handle is not below the incisal edge");
    const v = await view(page, "design", c0);
    const len = v.scr(h.length);
    await T.drag(len, { x: len.x, y: len.y + 18 });
    await page.waitForTimeout(800);
    const c1 = await current(page);
    assert(c1.design.wl < c0.design.wl && c1.design.wl >= 0.5, `lower wl ${c0.design.wl} -> ${c1.design.wl}`);
    await shot("03b-teeth-lower");
    await page.getByRole("radio", { name: "Upper", exact: true }).click();
    await page.waitForTimeout(800);
    const c2 = await current(page);
    assert(c2.design.arch === "upper", "back to upper failed");
    const pt = await page.locator(".panel").innerText();
    assert(/Follow lower lip/i.test(pt), `upper controls missing after switching back: ${pt.slice(0, 400)}`);
    return `wl ${c0.design.wl} -> ${c1.design.wl}`;
  });

  await test(devName, "Prep map: toggle shows the disclaimer, legend and per-tooth list (Teeth + Compare)", async () => {
    await gotoStep(page, "Teeth");
    const h0 = await canvasHash(page);
    await page.getByRole("switch", { name: /Prep map/ }).click();
    await page.waitForTimeout(600);
    const txt = await page.locator(".panel").innerText();
    assert(/Planning aid only\. Measured from a 2D photo/.test(txt), "disclaimer missing in Teeth");
    assert(/Green/.test(txt) && /Red/.test(txt), "legend missing");
    const n = await page.locator(".prep-list li").count();
    assert(n >= 6, `per-tooth list has ${n} rows`);
    assert(await page.locator(".disclaimer").isVisible(), "disclaimer not visible");
    assert((await canvasHash(page)) !== h0, "map did not change the canvas");
    await shot("03c-prep-map");
    await page.getByRole("switch", { name: /Prep map/ }).click();
    await gotoStep(page, "Compare");
    await page.getByRole("switch", { name: /Prep map/ }).click();
    await page.waitForTimeout(400);
    assert(await page.locator(".panel .disclaimer").isVisible(), "disclaimer missing in Compare");
    await shot("05b-compare-prep");
    await page.getByRole("switch", { name: /Prep map/ }).click();
    return `${n} teeth`;
  });

  await test(devName, "Sheets: clinician and patient sheets share A4 PNGs (1240x1754) and print", async () => {
    await gotoStep(page, "Compare");
    const out = [];
    for (const [btn, kind] of [
      ["Prep sheet", "clinician"],
      ["Patient sheet", "patient"],
    ]) {
      await page.evaluate(() => (window.__shared = []));
      await page.getByRole("button", { name: btn, exact: true }).click();
      const dlg = page.getByRole("dialog");
      await dlg.waitFor();
      await shot(`07-sheet-dialog-${kind}`);
      await dlg.getByRole("button", { name: "Share PNG" }).click();
      await agreeIfAsked(page);
      await page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 20000 });
      const files = await sharedInfo(page);
      for (const f of files) {
        fs.writeFileSync(path.join(EXPORTS, `${slug(devName)}-${f.name}`), Buffer.from(f.png, "base64"));
        assert(f.type === "image/png" && /\.png$/.test(f.name), `${kind}: not a png ${f.name}`);
        assert(f.w === 1240 && f.h === 1754, `${kind}: page ${f.w}x${f.h}, expected 1240x1754`);
      }
      // print path: the same pages go to the print style sheet
      if (!(await dlg.isVisible().catch(() => false))) await page.getByRole("button", { name: btn, exact: true }).click();
      await page.evaluate(() => (window.__printed = []));
      await dlg.getByRole("button", { name: "Print / PDF" }).click();
      await page.waitForFunction(() => window.__printed.length > 0, null, { timeout: 20000 });
      const printed = await page.evaluate(() => window.__printed[0]);
      assert(printed.length === files.length && printed.every(([w, h]) => w === 1240 && h === 1754), `${kind}: printed ${JSON.stringify(printed)}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      out.push(`${kind} ${files.length}p`);
    }
    return out.join(", ");
  });

  // ---------- round 4: case planner ----------
  // ---------- 3D wax-up (SYNTHETIC STL meshes) ----------
  await test(devName, "Wax-up: synthetic scan + moved wax-up are aligned on the phone and listed per tooth in mm", async () => {
    const { makeArchStl } = require("./make_arch_stl.cjs");
    const orig = path.join(TMP, "arch-original.stl"), wax = path.join(TMP, "arch-waxup.stl");
    makeArchStl(orig);
    makeArchStl(wax, { grow: 0.6, moved: true });
    await gotoStep(page, "Plan");
    await page.getByRole("button", { name: /3D wax-up/ }).click();
    await page.locator(".waxup .wax-files").waitFor();
    await page.getByRole("radio", { name: "Lower" }).click();
    for (const [slot, f] of [["Original scan", orig], ["Lab wax-up", wax]]) {
      const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: new RegExp(slot) }).click()]);
      await fc.setFiles(f);
      await page.waitForTimeout(200);
    }
    await page.locator(".wax-fit").waitFor({ timeout: 30000 });
    const fit = await page.locator(".wax-fit").innerText();
    if (!/< 0\.05/.test(fit)) throw new Error(`alignment not tight: ${fit}`);
    const teeth = (await page.locator(".wax-teeth b").allInnerTexts()).map((t) => +t.replace(/\D/g, "")).sort();
    if (teeth.join() !== "31,32,33,41,42,43") throw new Error(`changed teeth ${teeth.join()}`);
    const line = await page.locator(".wax-teeth li").first().innerText();
    if (!/facial \+0\.\d/.test(line)) throw new Error(`no facial mm: ${line}`);
    await page.getByRole("radio", { name: "Occlusal" }).click();
    await page.waitForTimeout(300);
    await shot("waxup");
    // the files are kept with the case on this device: closing and reopening shows them without picking again
    await page.getByRole("button", { name: "Back to the plan" }).click();
    await page.getByRole("button", { name: /3D wax-up/ }).click();
    await page.getByRole("radio", { name: "Lower" }).click();
    await page.locator(".wax-fit").waitFor({ timeout: 30000 });
    const before = await page.evaluate(() => window.__shared.length);
    await page.getByRole("button", { name: "Save image" }).click();
    await page.waitForFunction((n) => window.__shared.length > n, before, { timeout: 10000 });
    await page.getByRole("button", { name: "Back to the plan" }).click();
    return `teeth ${teeth.join(" ")}; ${fit.trim()}`;
  });

  await test(devName, "Plan: shade pins (reference + match) give a ΔE00 gap with the photo-estimate note", async () => {
    await gotoStep(page, "Plan");
    await page.getByRole("tab", { name: /Shade/ }).click();
    await page.waitForTimeout(200);
    const c = await current(page);
    const v = await view(page, "plan", c);
    const n0 = (c.plan?.shade.samples || []).length;
    await page.getByRole("button", { name: "Pick reference" }).click();
    await T.tap(v.scr({ x: IMG.w * 0.43, y: IMG.h * 0.707 }));
    await page.waitForTimeout(150);
    assert((await page.getByRole("button", { name: "Pick reference" }).getAttribute("aria-pressed")) === "false", "pick mode did not end after one pin");
    await page.getByRole("button", { name: "Pick tooth to match" }).click();
    await T.tap(v.scr({ x: IMG.w * 0.47, y: IMG.h * 0.75 }));
    await page.waitForTimeout(300);
    const txt = await page.locator(".panel").innerText();
    assert(/ΔE00/.test(txt), "no ΔE00 read-out");
    assert(/Photo estimate: confirm with a shade guide/.test(txt), "photo-estimate note missing");
    assert(/Mostly yellowness\/chroma/.test(txt), `expected a chroma-dominant gap for the yellower lower teeth: ${txt.slice(0, 400)}`);
    assert(/approximate/.test(txt), "nearest tab not labelled approximate");
    await shot("08-plan-shade");
    // dragging a pin moves it (and re-samples)
    const c1 = await current(page);
    const s1 = c1.plan.shade.samples;
    assert(s1.length === n0 + 2, `expected ${n0 + 2} samples, saved ${s1.length}`);
    const last = s1[s1.length - 1];
    const head = v.scr(last.pt);
    await T.drag(head, { x: head.x + 12, y: head.y });
    await page.waitForTimeout(700);
    const moved = (await current(page)).plan.shade.samples.slice(-1)[0];
    assert(moved.pt.x > last.pt.x + 2, `pin did not move (${last.pt.x.toFixed(1)} -> ${moved.pt.x.toFixed(1)})`);
    return txt.match(/ΔE00\s*[\d.]+/)?.[0] ?? "";
  });

  await test(devName, "Plan: tap includes a tooth, long-press opens its sheet; crown on 41 raises a caution; undo/redo", async () => {
    await page.getByRole("tab", { name: /Teeth/ }).click();
    await page.waitForTimeout(150);
    const t41 = page.locator(".odonto .tooth", { hasText: /^41/ });
    const t44 = page.locator(".odonto .tooth", { hasText: /^44/ });
    const was = await t44.getAttribute("aria-pressed");
    await t44.click();
    assert((await t44.getAttribute("aria-pressed")) !== was, "tap did not toggle tooth 44");
    await t44.click();
    if ((await t41.getAttribute("aria-pressed")) !== "true") await t41.click();
    await t41.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const box = await t41.boundingBox();
    assert(box.height >= 44 && box.width >= 40, `tooth target ${Math.round(box.width)}x${Math.round(box.height)}`);
    await T.hold({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const dlg = page.getByRole("dialog");
    await dlg.waitFor({ timeout: 3000 });
    assert(/tooth 41/i.test(await dlg.locator("h2").innerText()), "sheet is not for tooth 41");
    await dlg.getByRole("radio", { name: "Zirconia crown" }).click();
    await page.waitForTimeout(450);
    await dlg.getByRole("radio", { name: "Crown prep" }).click();
    await page.waitForTimeout(200);
    assert(/Planning aid only/.test(await dlg.innerText()), "prep disclaimer missing in the tooth sheet");
    assert(/Crown on a lower incisor/.test(await dlg.innerText()), "crown caution not shown in the tooth sheet");
    await shot("09-plan-tooth-sheet");
    await dlg.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(500);
    const saved = (await current(page)).plan.teeth.find((t) => t.fdi === 41);
    assert(saved && saved.include && saved.prep === "crown" && saved.material === "zirconia-crown", `41 not saved: ${JSON.stringify(saved)}`);
    await shot("10-plan-teeth");
    await page.getByRole("tab", { name: /Review/ }).click();
    const rv = page.locator(".panel .warnings");
    await rv.waitFor();
    const li = rv.locator("li", { hasText: "Crown on a lower incisor" });
    assert((await li.count()) === 1, "crown warning missing in Review");
    assert(/caution/.test(await li.getAttribute("class")), "crown warning is not a caution");
    assert(/41/.test(await li.innerText()), "crown warning has no 41 tag");
    await shot("11-plan-review");
    // undo reverts the last plan edit, redo brings it back
    await page.getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(500);
    const u = (await current(page)).plan.teeth.find((t) => t.fdi === 41);
    assert(u.prep !== "crown", `undo did not revert the prep (${u.prep})`);
    await page.getByRole("button", { name: "Redo" }).click();
    await page.waitForTimeout(500);
    const r = (await current(page)).plan.teeth.find((t) => t.fdi === 41);
    assert(r.prep === "crown", `redo did not restore the prep (${r.prep})`);
  });

  await test(devName, "Plan: lab prescription shares an A4 PNG and prints", async () => {
    await page.getByRole("tab", { name: /Review/ }).click();
    await page.evaluate(() => (window.__shared = []));
    await page.getByRole("button", { name: "Lab prescription" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    await shot("12-lab-dialog");
    await dlg.getByRole("button", { name: "Share PNG" }).click();
    await agreeIfAsked(page);
    await page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 20000 });
    const files = await sharedInfo(page);
    for (const f of files) {
      fs.writeFileSync(path.join(EXPORTS, `${slug(devName)}-${f.name}`), Buffer.from(f.png, "base64"));
      assert(/^lab-prescription-.*\.png$/.test(f.name) && f.type === "image/png", `not a lab png: ${f.name}`);
      assert(f.w === 1240 && f.h === 1754, `lab page ${f.w}x${f.h}`);
    }
    if (!(await dlg.isVisible().catch(() => false))) await page.getByRole("button", { name: "Lab prescription" }).click();
    await page.evaluate(() => (window.__printed = []));
    await dlg.getByRole("button", { name: "Print / PDF" }).click();
    await page.waitForFunction(() => window.__printed.length > 0, null, { timeout: 20000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    // the prep sheet now carries the plan (one more page than before)
    await page.evaluate(() => (window.__shared = []));
    await page.getByRole("button", { name: "Prep sheet + plan" }).click();
    await dlg.getByRole("button", { name: "Share PNG" }).click();
    await page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 20000 });
    const prep = await sharedInfo(page);
    prep.forEach((f) => fs.writeFileSync(path.join(EXPORTS, `${slug(devName)}-plan-${f.name}`), Buffer.from(f.png, "base64")));
    assert(prep.every((f) => f.w === 1240 && f.h === 1754), "prep sheet with plan: not A4");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    return `lab ${files.length}p, prep+plan ${prep.length}p`;
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
    // photo-real mode only changes the patient's real teeth, so compare a grid over the whole design area
    const grid = (
      await page.evaluate(async (c) => {
        const g = await import("/src/geometry.ts");
        const a = g.designAngle(c.design, c.guides);
        const L = g.centralLength(c.design);
        const out = [];
        for (let i = -3; i <= 3; i++) for (let j = 1; j <= 4; j++) out.push(g.toImage({ x: (c.design.width / 2) * (i / 3.2), y: -L * (j / 5) }, c.design, a));
        return out;
      }, c)
    ).map((q) => v.scr(q));
    const gridPixels = async () => Promise.all(grid.map((q) => pixel(page, q)));
    const y = v.r.y + v.r.height * 0.15;
    // divider far left -> simulation everywhere right of it
    await T.drag({ x: v.r.x + v.r.width * 0.5, y }, { x: v.r.x + 4, y });
    await page.waitForTimeout(150);
    const sim = await pixel(page, tp);
    const simGrid = await gridPixels();
    await shot("05-compare-left");
    // divider far right -> photo
    await T.drag({ x: v.r.x + 4, y }, { x: v.r.x + v.r.width - 4, y });
    await page.waitForTimeout(150);
    const now = await pixel(page, tp);
    const nowGrid = await gridPixels();
    await shot("05-compare-right");
    const maxDiff = Math.max(...simGrid.map((p, i) => cdiff(p, nowGrid[i])));
    assert(maxDiff > 25, `teeth area identical either side of divider (max colour difference ${maxDiff})`);
    await T.drag({ x: v.r.x + v.r.width - 4, y }, { x: v.r.x + 4, y });
    await page.waitForTimeout(150);
    const before = page.getByRole("button", { name: "Before", exact: true });
    await before.click();
    await page.waitForTimeout(150);
    const held = await pixel(page, tp);
    assert((await before.getAttribute("aria-pressed")) === "true", "Before toggle not pressed");
    await before.click();
    assert(cdiff(held, now) < 25, `Before: still shows teeth: ${held} vs photo ${now}`);
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
      // first share of a case asks whether the patient agreed
      const agree = page.getByRole("button", { name: "Yes, patient agreed" });
      if (await agree.isVisible({ timeout: 1000 }).catch(() => false)) await agree.click();
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
    await page.waitForFunction(() => document.querySelector(".stage canvas")?.clientWidth > 0);
    const c1 = await current(page);
    assert(near(c1.guides.midline.x, want.x, 0.01), `midline ${c1.guides.midline.x} != saved ${want.x}`);
  });

  await test(devName, "autosave: an edit made just before the page is closed is kept", async () => {
    await page.waitForTimeout(400); // let the reopened editor settle its view before computing handle positions
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
    // in-app sheet: ⋯ > Delete > Keep / Delete
    const sheet = page.getByRole("dialog");
    await page.locator(".card-more").first().click();
    await sheet.getByRole("button", { name: "Delete", exact: true }).click();
    await sheet.getByRole("button", { name: "Keep" }).click();
    await page.waitForTimeout(300);
    assert((await cases(page)).length === n0, "Keep deleted the case");
    await page.locator(".card-more").first().click();
    await sheet.getByRole("button", { name: "Delete", exact: true }).click();
    await sheet.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForTimeout(500);
    assert((await cases(page)).length === n0 - 1, "OK did not delete the case");
    assert((await page.locator(".card").count()) === n0 - 1, "card still listed after delete");
    if (n0 === 1) assert(/No designs on this phone yet/.test(await page.locator(".cases").innerText()), "empty-state text missing");
  });

  const jsErr = errors.filter((e) => !/favicon/.test(e));
  await test(devName, "no JS errors in console", async () => {
    assert(jsErr.length === 0, jsErr.slice(0, 5).join("\n"));
  });
  await ctx.close();
}

// ---------- round 6: synthetic retracted bite (fit to teeth, shade pin quality, toast placement, hidden prep area) ----------
/** Patch the most recent case in IndexedDB (test fixture: guides / lips for the synthetic bite). Editor must be closed. */
const patchLatest = (page, patch) =>
  page.evaluate(async (patch) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("smile-studio");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const all = await new Promise((res) => {
      const r = db.transaction("cases", "readonly").objectStore("cases").getAll();
      r.onsuccess = () => res(r.result);
    });
    const c = all.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const next = { ...c, ...patch, design: { ...c.design, ...(patch.design || {}) }, updatedAt: c.updatedAt + 1 };
    await new Promise((res, rej) => {
      const tx = db.transaction("cases", "readwrite");
      tx.objectStore("cases").put(next);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, patch);
const boxOf = (page, sel) => page.locator(sel).first().boundingBox();
const overlap = (a, b) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function biteSuite(browser, devName, bite, truth) {
  const { defaultBrowserType, ...dev } = devices[devName];
  const ctx = await browser.newContext({ ...dev, acceptDownloads: true });
  await ctx.addInitScript(SHARE_STUB);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${slug(devName)}-bite-${n}.png`) });
  const T = await touch(page);
  const dn = `${devName} · bite`;
  console.log(`\n# ${dn}`);

  await test(dn, "bite: import the synthetic retracted photo (close-up framing, lips around both arches)", async () => {
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.getByRole("heading", { name: /Design the smile/ }).waitFor();
    await importPhoto(page, bite);
    await page.getByRole("button", { name: "Back to cases" }).click();
    await page.locator(".card").first().waitFor();
    await patchLatest(page, {
      framing: "closeup",
      guides: { pupilR: { x: 130, y: 440 }, pupilL: { x: 1070, y: 440 }, midline: { x: truth.midX, y: 300 } },
      lips: truth.lips.map(([x, y]) => ({ x, y })),
      design: { center: { x: truth.midX, y: truth.upperEdgeY }, width: 560, arch: "upper", count: 6 },
    });
    // Home lists cases once: reload so the card opens the patched record
    await page.reload();
    await page.locator(".card-open").first().waitFor();
    await page.locator(".card-open").first().click();
    await page.locator(".topbar .title .h").waitFor();
    await page.waitForFunction(() => document.querySelector(".stage canvas")?.clientWidth > 0);
    await page.waitForTimeout(1200); // let the editor autosave once, then check it kept the fixture
    const c = await current(page);
    assert(c.imgW === truth.w && c.lips.length === 16 && c.framing === "closeup", `fixture not applied (${c.imgW}, ${c.lips.length} lip points)`);
  });

  await test(dn, "Fit to teeth: two canine taps set width / centre / tilt of the lower template; undo restores", async () => {
    await gotoStep(page, "Teeth");
    await page.getByRole("radio", { name: "Lower", exact: true }).click();
    await page.waitForTimeout(500);
    assert(await page.locator(".fit-chip").isVisible(), "no 'Fit to teeth' hint chip after switching to Lower");
    await shot("10-fit-before");
    const before = (await current(page)).design;
    await page.locator(".fit-chip").click();
    await page.waitForTimeout(300);
    assert(/right canine/.test(await page.locator(".panel").innerText()), "fit steps not shown");
    assert(await page.locator(".side-tag.left", { hasText: "Patient's right" }).isVisible(), "patient's-right side tag missing");
    await page.getByRole("button", { name: "Fit whole photo to screen" }).click();
    await page.waitForTimeout(300);
    const c0 = await current(page);
    const v = await view(page, "guides", c0);
    const [R, L] = [truth.lowerCanineR, truth.lowerCanineL].map(([x, y]) => ({ x, y }));
    await T.tap(v.scr(R));
    await page.waitForTimeout(250);
    assert(/left canine/.test(await page.locator(".stage-tag.fit-tag").innerText()), "second prompt missing");
    await T.tap(v.scr(L));
    await page.waitForTimeout(900);
    await shot("11-fit-taps");
    const d = (await current(page)).design;
    const want = 2 * truth.lowerCentralW * (1 + 1.03 + 0.8); // drawn canine-to-canine span of the synthetic lower teeth
    const cw = truth.lowerCentralW;
    assert(d.arch === "lower", `arch ${d.arch}`);
    assert(Math.abs(d.width - want) / want < 0.06, `width ${d.width.toFixed(1)} vs drawn ${want.toFixed(1)}`);
    assert(Math.abs(d.center.x - truth.midX) < cw * 0.3 + 8, `centre x ${d.center.x.toFixed(1)} vs ${truth.midX}`);
    assert(d.center.y > truth.lowerIncisalY - 12 && d.center.y < truth.upperEdgeY, `centre y ${d.center.y.toFixed(1)}`);
    assert(Math.abs(d.tilt) < 1.5, `tilt ${d.tilt}`);
    const tips = await page.evaluate(async ({ d, g }) => (await import("/src/fit.ts")).canineTips(d, g), { d, g: c0.guides });
    const miss = Math.max(Math.hypot(tips[0].x - R.x, tips[0].y - R.y), Math.hypot(tips[1].x - L.x, tips[1].y - L.y));
    assert(miss < cw * 0.35 + 6, `canine boxes ${miss.toFixed(1)} px from the taps`);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.waitForTimeout(500);
    await shot("12-fit-after");
    await page.getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(500);
    const u = (await current(page)).design;
    assert(Math.abs(u.width - before.width) < 1, `undo: width ${u.width.toFixed(1)} (before ${before.width.toFixed(1)})`);
    await page.getByRole("button", { name: "Redo" }).click();
    await page.waitForTimeout(500);
    return `width ${d.width.toFixed(0)} (drawn ${want.toFixed(0)}), centre ${d.center.x.toFixed(0)},${d.center.y.toFixed(0)}, wl ${d.wl}, miss ${miss.toFixed(1)} px`;
  });

  await test(dn, "Prep map on the lower plan: area behind the upper teeth is hatched, legend + per-tooth note", async () => {
    await gotoStep(page, "Teeth");
    await page.getByRole("switch", { name: /Prep map/ }).click();
    await page.waitForTimeout(1200);
    const txt = await page.locator(".panel").innerText();
    assert(/Hidden behind the upper teeth — not measurable/.test(txt), `hidden legend missing: ${txt.slice(0, 300)}`);
    assert(/Partly hidden behind the upper teeth: length not measurable from this photo\./.test(txt), "per-tooth hidden note missing");
    assert(/Planning aid only\. Measured from a 2D photo/.test(txt), "disclaimer missing");
    await shot("13-prep-hidden");
    await page.getByRole("switch", { name: /Prep map/ }).click();
  });

  await test(dn, "Shade pin on the gum: ring + amber warning; moved onto the tooth it clears", async () => {
    await gotoStep(page, "Plan");
    await page.getByRole("tab", { name: /Shade/ }).click();
    await page.waitForTimeout(200);
    const c = await current(page);
    const v = await view(page, "plan", c);
    await page.getByRole("button", { name: "Pick tooth to match" }).click();
    const gum = { x: truth.gumPinPt[0], y: truth.gumPinPt[1] };
    await T.tap(v.scr(gum));
    await page.waitForTimeout(500);
    const s1 = (await current(page)).plan.shade.samples.slice(-1)[0];
    assert(s1.q && s1.q.ok === false, `gum pin not flagged: ${JSON.stringify(s1.q)}`);
    assert(s1.r > 1 && s1.r < cwOf(c) * 0.25, `sample radius ${s1.r}`);
    const warn = page.locator(".samples .warn");
    if (!(await warn.count())) throw new Error(`no warning in the shade card: ${(await page.locator(".panel").innerText()).slice(0, 500)}`);
    assert(/This spot includes gum or shadow; move the pin onto the middle third of the tooth\./.test(await warn.first().innerText()), "warning text missing");
    await shot("14-pin-gum");
    // drag the pin up onto the middle third of the lower central
    const tooth = { x: truth.toothPinPt[0], y: truth.toothPinPt[1] };
    await T.drag(v.scr(gum), v.scr(tooth), 10);
    await page.waitForTimeout(700);
    const s2 = (await current(page)).plan.shade.samples.slice(-1)[0];
    assert(s2.q && s2.q.ok === true, `pin on the tooth still flagged: ${JSON.stringify(s2.q)} at ${JSON.stringify(s2.pt)}`);
    assert((await page.locator(".samples .warn").count()) === 0, "warning still shown");
    await shot("15-pin-tooth");
    return `gum: ${Math.round(s1.q.rej * 100)} % rejected; tooth: ${Math.round(s2.q.rej * 100)} %`;
  });

  await test(dn, "toast sits under the top bar: never over the controls sheet / tooth chart or the tab bar", async () => {
    await page.getByRole("tab", { name: /Review/ }).click();
    // no share sheet: the app downloads and says "Image saved to downloads"
    await page.evaluate(() => (navigator.canShare = () => false));
    await page.getByRole("button", { name: "Lab prescription" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    await dlg.getByRole("button", { name: "Share PNG" }).click();
    await agreeIfAsked(page);
    await page.locator(".toast", { hasText: /saved to downloads/ }).waitFor({ timeout: 20000 });
    if (await dlg.isVisible().catch(() => false)) await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: /Teeth/ }).click();
    await page.waitForTimeout(120);
    const toast = await boxOf(page, ".toast");
    assert(toast, "toast gone too early to measure");
    const chart = await boxOf(page, ".odonto");
    const side = await boxOf(page, ".side");
    const steps = await boxOf(page, ".steps");
    const top = await boxOf(page, ".topbar");
    await shot("16-toast");
    assert(!overlap(toast, chart), `toast covers the tooth chart ${JSON.stringify(toast)} ${JSON.stringify(chart)}`);
    assert(!overlap(toast, side), `toast covers the controls ${JSON.stringify(toast)} ${JSON.stringify(side)}`);
    assert(!overlap(toast, steps), "toast covers the step bar");
    assert(toast.y >= top.y + top.height - 1, "toast covers the top bar");
    await page.waitForTimeout(2600);
    assert((await page.locator(".toast").count()) === 0, "toast still visible after 2.6 s");
    return `toast y ${Math.round(toast.y)}–${Math.round(toast.y + toast.height)}, sheet from ${Math.round(side.y)}`;
  });

  const jsErr = errors.filter((e) => !/favicon/.test(e));
  await test(dn, "no JS errors in console", async () => {
    assert(jsErr.length === 0, jsErr.slice(0, 5).join("\n"));
  });
  await ctx.close();
}
const cwOf = (c) => c.design.width / (2 * (1 + 1.03 + 0.8));

// ---------- round 7: Labs · Auto-detect (beta). OFF by default; on-device MediaPipe; every result confirmed first ----------
const LABS_KEY = "smile-studio.labs.autodetect.v1";
const LABS_FAIL = "Auto-detect isn't available on this phone; you can place the dots by hand.";
/** Requests that belong to the beta (lazy code, wasm, models). */
const isLabsReq = (u) => /\/models\/|\/src\/ai\/|@mediapipe|tasks-vision|\/assets\/labs-/.test(u);
const sameOrigin = (u, origin) => u.startsWith(origin) || u.startsWith("data:") || u.startsWith("blob:");
/** MediaPipe's runtime prints INFO / GL notes through console.error; they are not app errors. */
const mpNoise = (t) => /^INFO:|GL Driver Message|XNNPACK|GPU stall|TensorFlow Lite|Failed to load resource/.test(t);
/** White pixels of a stored ToothMask PNG. */
const maskOn = (page, tm) =>
  page.evaluate(async (tm) => {
    const im = new Image();
    im.src = tm.png;
    await im.decode();
    const cv = document.createElement("canvas");
    cv.width = tm.w;
    cv.height = tm.h;
    const x = cv.getContext("2d");
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, tm.w, tm.h).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 127) n++;
    return n;
  }, tm);
/** All-black (empty) existing-teeth mask PNG at the app's mask size for a w × h photo. */
const emptyMask = (page, w, h) =>
  page.evaluate(
    ({ w, h }) => {
      const s = Math.min(1, 768 / Math.max(w, h));
      const cv = document.createElement("canvas");
      cv.width = Math.round(w * s);
      cv.height = Math.round(h * s);
      const x = cv.getContext("2d");
      x.fillStyle = "#000";
      x.fillRect(0, 0, cv.width, cv.height);
      return { w: cv.width, h: cv.height, png: cv.toDataURL("image/png") };
    },
    { w, h },
  );
/** A fixed 478-landmark set for the stubbed detector: irises, midline column, inner lips around (0.5, 0.72). */
function stubLandmarks() {
  const lms = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const up = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
  const lo = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
  for (let j = 0; j < up.length; j++) {
    const t = j / (up.length - 1);
    const b = Math.sin(Math.PI * t);
    lms[up[j]] = { x: 0.37 + 0.26 * t, y: 0.705 - 0.02 * b };
    lms[lo[j]] = { x: 0.37 + 0.26 * t, y: 0.705 + 0.045 * b };
  }
  for (const i of [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 17, 18, 200, 199, 175, 152]) lms[i] = { x: 0.505, y: lms[i].y };
  lms[164] = { x: 0.505, y: 0.6 };
  lms[0] = { x: 0.505, y: 0.66 };
  lms[468] = { x: 0.39, y: 0.362 };
  lms[473] = { x: 0.61, y: 0.358 };
  lms[61] = { x: 0.35, y: 0.7 };
  lms[291] = { x: 0.65, y: 0.7 };
  return lms;
}
/** Stand-in for src/ai/mediapipe.ts (vite dev serves it as its own module): fixed outputs, or a hang / failure. */
const STUB_MODULE = `
export async function faceLandmarks() {
  if (window.__labsStub === "hang") return new Promise(() => {});
  if (window.__labsStub === "fail") throw new Error("stub failure");
  return window.__labsLms || null;
}
export async function segmentAt(cv, x, y) {
  const w = 64, h = 64, d = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (Math.hypot((i + 0.5) / w - x, (j + 0.5) / h - y) < 0.18) d[j * w + i] = 0.95;
  return { data: d, w, h };
}`;

async function labsContext(browser, devName, { on = true, stub = null } = {}) {
  const { defaultBrowserType, ...dev } = devices[devName];
  const ctx = await browser.newContext({ ...dev });
  await ctx.addInitScript(SHARE_STUB);
  if (on) await ctx.addInitScript((k) => localStorage.setItem(k, "1"), LABS_KEY);
  if (stub) {
    await ctx.addInitScript(({ mode, lms }) => ((window.__labsStub = mode), (window.__labsLms = lms)), { mode: stub, lms: stubLandmarks() });
    await ctx.route("**/src/ai/mediapipe.ts*", (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: STUB_MODULE }));
  }
  const page = await ctx.newPage();
  const reqs = [];
  const errors = [];
  page.on("request", (r) => reqs.push(r.url()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !mpNoise(m.text()) && errors.push(m.text()));
  return { ctx, page, reqs, errors, T: await touch(page) };
}
const waitAi = (page) => page.waitForFunction(() => !document.querySelector(".toast .spinner"), null, { timeout: 20000 });
const toastText = (page) => page.locator(".toast").innerText({ timeout: 1500 }).catch(() => "");
const sameGuides = (a, b) => ["pupilR", "pupilL", "midline"].every((k) => Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y) < 0.05);

async function labsSuite(browser, devName, face, bite, truth) {
  const dn = `${devName} · labs`;
  const base = `http://127.0.0.1:${PORT}/`;
  const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, `${slug(devName)}-labs-${n}.png`) });
  const allReqs = [];
  const allErrs = [];
  console.log(`\n# ${dn}`);

  // (i) flag OFF: identical UI, nothing of the beta is requested
  await test(dn, "Labs off (default): switch off in Settings, no Labs controls in the editor, no model or Labs code requested", async () => {
    const L = await labsContext(browser, devName, { on: false });
    const { page, reqs } = L;
    try {
      await page.goto(base);
      await page.getByRole("heading", { name: /Design the smile/ }).waitFor();
      assert((await page.evaluate((k) => localStorage.getItem(k), LABS_KEY)) === null, "flag set without the user");
      await page.getByRole("button", { name: "Settings" }).click();
      const sw = page.getByRole("switch", { name: /Auto-detect \(beta\)/ });
      assert((await sw.getAttribute("aria-checked")) === "false", "Labs switch is not off by default");
      await shot(page, "00-settings-off");
      await page.getByRole("button", { name: "Done" }).click();
      await importPhoto(page, face);
      for (const step of ["Face", "Lips"]) {
        await gotoStep(page, step);
        assert((await page.locator(".ai-btn, .ai-confirm, .beta-tag").count()) === 0, `Labs controls visible on ${step} with the flag off`);
      }
      await page.getByRole("radio", { name: "Existing teeth" }).click();
      await page.waitForTimeout(400);
      const brush = await page.getByRole("radiogroup", { name: "Brush" }).getByRole("radio").allInnerTexts();
      assert(JSON.stringify(brush) === JSON.stringify(["Paint", "Erase"]), `brush options changed: ${brush}`);
      assert((await page.locator(".ai-btn, .ai-confirm, .beta-tag").count()) === 0, "Labs controls visible in Existing teeth");
      await page.getByRole("radio", { name: "Lip line" }).click();
      await gotoStep(page, "Teeth");
      await page.waitForTimeout(600);
      const labsReqs = reqs.filter(isLabsReq);
      assert(labsReqs.length === 0, `flag off but requested: ${labsReqs.join(" ")}`);
      assert(L.errors.length === 0, L.errors.slice(0, 3).join("\n"));
      return `${reqs.length} requests, 0 Labs`;
    } finally {
      await L.ctx.close();
    }
  });

  await test(dn, "Settings › Labs: the switch turns the beta on and is remembered on this phone", async () => {
    const L = await labsContext(browser, devName, { on: false });
    const { page } = L;
    try {
      await page.goto(base);
      await page.getByRole("button", { name: "Settings" }).click();
      const sw = page.getByRole("switch", { name: /Auto-detect \(beta\)/ });
      await sw.click();
      assert((await sw.getAttribute("aria-checked")) === "true", "switch did not turn on");
      assert((await page.evaluate((k) => localStorage.getItem(k), LABS_KEY)) === "1", "flag not stored");
      await shot(page, "01-settings-on");
      await page.getByRole("button", { name: "Done" }).click();
      await page.reload();
      await page.getByRole("button", { name: "Settings" }).click();
      assert((await page.getByRole("switch", { name: /Auto-detect \(beta\)/ }).getAttribute("aria-checked")) === "true", "flag not remembered");
      await page.getByRole("switch", { name: /Auto-detect \(beta\)/ }).click();
      assert((await page.evaluate((k) => localStorage.getItem(k), LABS_KEY)) === null, "turning it off did not clear the flag");
      assert(L.reqs.filter(isLabsReq).length === 0, "the switch alone fetched Labs files");
    } finally {
      await L.ctx.close();
    }
  });

  // (ii) flag ON, real on-device model on the synthetic cartoon face
  await test(dn, "Labs on, synthetic face: Auto-detect points shows ghost dots (or the calm fallback); nothing changes until confirmed; one undo step", async () => {
    const L = await labsContext(browser, devName);
    const { page } = L;
    try {
      await page.goto(base);
      await importPhoto(page, face);
      const c0 = await current(page);
      const h0 = await canvasHash(page);
      await page.getByRole("button", { name: /Auto-detect points/ }).click();
      await waitAi(page);
      await page.waitForTimeout(300);
      if (!(await page.locator(".ai-confirm").isVisible())) {
        // graceful fallback: calm toast, case untouched, manual drag still works
        const t = await toastText(page);
        assert(/No face found|isn't available/.test(t), `no proposal and no fallback toast ("${t}")`);
        assert(sameGuides((await current(page)).guides, c0.guides), "guides changed without a proposal");
        const v = await view(page, "guides", c0);
        const a = v.scr(c0.guides.pupilR);
        await L.T.drag(a, { x: a.x, y: a.y + 20 });
        await page.waitForTimeout(800);
        assert(!sameGuides((await current(page)).guides, c0.guides), "manual drag did not work after the fallback");
        return `no face found on the cartoon: "${t}"`;
      }
      await page.waitForTimeout(700);
      assert(sameGuides((await current(page)).guides, c0.guides), "a proposal changed the case before it was confirmed");
      assert((await canvasHash(page)) !== h0, "ghost dots not drawn");
      await shot(page, "02-face-ghost");
      await page.getByRole("button", { name: "Use these points" }).click();
      await page.waitForTimeout(900);
      const c1 = await current(page);
      const W = c1.imgW;
      const H = c1.imgH;
      const miss = Math.max(Math.hypot(c1.guides.pupilR.x - 0.38 * W, c1.guides.pupilR.y - 0.36 * H), Math.hypot(c1.guides.pupilL.x - 0.62 * W, c1.guides.pupilL.y - 0.36 * H));
      assert(!sameGuides(c1.guides, c0.guides), "Use these points did not apply");
      await shot(page, "03-face-applied");
      await page.getByRole("button", { name: "Undo" }).click();
      await page.waitForTimeout(900);
      assert(sameGuides((await current(page)).guides, c0.guides), "one undo did not restore the dots");
      await page.getByRole("button", { name: "Redo" }).click();
      await page.waitForTimeout(600);
      // lips on the same photo: Cancel keeps the lip line
      await gotoStep(page, "Lips");
      const l0 = (await current(page)).lips;
      await page.getByRole("button", { name: /Auto-detect lip line/ }).click();
      await waitAi(page);
      await page.waitForTimeout(300);
      let lipNote = "no lip proposal";
      if (await page.locator(".ai-confirm").isVisible()) {
        await shot(page, "04-lips-ghost");
        await page.getByRole("button", { name: "Cancel" }).click();
        await page.waitForTimeout(700);
        assert(JSON.stringify((await current(page)).lips) === JSON.stringify(l0), "Cancel changed the lip line");
        await page.getByRole("button", { name: /Auto-detect lip line/ }).click();
        await waitAi(page);
        await page.getByRole("button", { name: "Use these points" }).click();
        await page.waitForTimeout(900);
        const l1 = (await current(page)).lips;
        assert(l1.length === 12 && JSON.stringify(l1) !== JSON.stringify(l0), "lip proposal not applied as 12 dots");
        await page.getByRole("button", { name: "Undo" }).click();
        await page.waitForTimeout(900);
        assert(JSON.stringify((await current(page)).lips) === JSON.stringify(l0), "undo did not restore the lip line");
        lipNote = "lips applied + undone";
      }
      allReqs.push(...L.reqs);
      allErrs.push(...L.errors);
      return `cartoon face detected; pupils ${miss.toFixed(1)} px from the drawn pupils; ${lipNote}`;
    } finally {
      await L.ctx.close();
    }
  });

  await test(dn, "Labs on, stubbed detector (fixed landmarks): exact mapping, Try again / Cancel / Use these points, one undo step", async () => {
    const L = await labsContext(browser, devName, { stub: "ok" });
    const { page } = L;
    try {
      await page.goto(base);
      await importPhoto(page, face);
      const c0 = await current(page);
      const want = await page.evaluate(async ({ lms, w, h }) => (await import("/src/ai/map.ts")).guidesFromLandmarks(lms, w, h, "face").guides, { lms: stubLandmarks(), w: c0.imgW, h: c0.imgH });
      await page.getByRole("button", { name: /Auto-detect points/ }).click();
      await page.locator(".ai-confirm").waitFor();
      await page.getByRole("button", { name: "Try again" }).click();
      await page.locator(".ai-confirm").waitFor();
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.waitForTimeout(700);
      assert((await page.locator(".ai-confirm").count()) === 0, "Cancel left the proposal open");
      assert(sameGuides((await current(page)).guides, c0.guides), "Cancel changed the dots");
      await page.getByRole("button", { name: /Auto-detect points/ }).click();
      await page.getByRole("button", { name: "Use these points" }).click();
      await page.waitForTimeout(900);
      const c1 = await current(page);
      assert(sameGuides(c1.guides, want), `applied ${JSON.stringify(c1.guides)} vs mapped ${JSON.stringify(want)}`);
      await page.getByRole("button", { name: "Undo" }).click();
      await page.waitForTimeout(900);
      assert(sameGuides((await current(page)).guides, c0.guides), "one undo did not restore the dots");
      allReqs.push(...L.reqs);
      allErrs.push(...L.errors);
      return `pupils ${want.pupilR.x.toFixed(0)},${want.pupilR.y.toFixed(0)} / ${want.pupilL.x.toFixed(0)},${want.pupilL.y.toFixed(0)}`;
    } finally {
      await L.ctx.close();
    }
  });

  await test(dn, "Labs on, model files unavailable: calm toast, case unchanged, manual flow continues", async () => {
    const L = await labsContext(browser, devName);
    const { page } = L;
    try {
      await L.ctx.route("**/models/**", (r) => r.abort());
      await page.goto(base);
      await importPhoto(page, face);
      const c0 = await current(page);
      await page.getByRole("button", { name: /Auto-detect points/ }).click();
      await page.waitForFunction((t) => document.querySelector(".toast")?.textContent?.includes(t), LABS_FAIL, { timeout: 12000 });
      await shot(page, "05-fallback-toast");
      assert(sameGuides((await current(page)).guides, c0.guides), "failure changed the dots");
      assert((await page.locator(".ai-confirm").count()) === 0, "a proposal is shown after a failure");
      const v = await view(page, "guides", c0);
      const a = v.scr(c0.guides.pupilL);
      await L.T.drag(a, { x: a.x, y: a.y + 20 });
      await page.waitForTimeout(800);
      assert(!sameGuides((await current(page)).guides, c0.guides), "manual drag did not work after the failure");
      assert(await page.getByRole("button", { name: /Auto-detect points/ }).isEnabled(), "Auto-detect stuck busy after the failure");
    } finally {
      await L.ctx.close();
    }
  });

  await test(dn, "Labs on, detector hangs: gives up after 8 s with the same calm toast", async () => {
    const L = await labsContext(browser, devName, { stub: "hang" });
    const { page } = L;
    try {
      await page.goto(base);
      await importPhoto(page, face);
      const c0 = await current(page);
      const t0 = Date.now();
      await page.getByRole("button", { name: /Auto-detect points/ }).click();
      await page.waitForFunction((t) => document.querySelector(".toast")?.textContent?.includes(t), LABS_FAIL, { timeout: 12000 });
      const ms = Date.now() - t0;
      assert(ms >= 7500 && ms < 11000, `timeout after ${ms} ms`);
      assert(sameGuides((await current(page)).guides, c0.guides), "timeout changed the dots");
      return `${(ms / 1000).toFixed(1)} s`;
    } finally {
      await L.ctx.close();
    }
  });

  // (iii) tap-to-outline on the synthetic bite (real MagicTouch model)
  await test(dn, "Labs on, synthetic bite: Tap a tooth adds mask area after confirm, Erase tooth removes it, undo restores", async () => {
    const L = await labsContext(browser, devName);
    const { page } = L;
    try {
      await page.goto(base);
      await importPhoto(page, bite);
      await page.getByRole("button", { name: "Back to cases" }).click();
      await page.locator(".card").first().waitFor();
      await patchLatest(page, {
        framing: "closeup",
        guides: { pupilR: { x: 130, y: 440 }, pupilL: { x: 1070, y: 440 }, midline: { x: truth.midX, y: 300 } },
        lips: truth.lips.map(([x, y]) => ({ x, y })),
        design: { center: { x: truth.midX, y: truth.upperEdgeY }, width: 560, arch: "upper", count: 6 },
        toothMask: await emptyMask(page, truth.w, truth.h),
      });
      await page.reload();
      await page.locator(".card-open").first().click();
      await page.locator(".topbar .title .h").waitFor();
      await page.waitForFunction(() => document.querySelector(".stage canvas")?.clientWidth > 0);
      await page.waitForTimeout(900);
      // a close-up without eyes: face auto-detect falls back calmly
      await page.getByRole("button", { name: /Auto-detect points/ }).click();
      await waitAi(page);
      const ft = await toastText(page);
      assert(/No face found|isn't available/.test(ft) || (await page.locator(".ai-confirm").isVisible()), `close-up: no fallback toast ("${ft}")`);
      if (await page.locator(".ai-confirm").isVisible()) await page.getByRole("button", { name: "Cancel" }).click();
      await gotoStep(page, "Lips");
      await page.getByRole("radio", { name: "Existing teeth" }).click();
      await page.waitForTimeout(600);
      const c0 = await current(page);
      const a0 = await maskOn(page, c0.toothMask);
      assert(a0 === 0, `fixture mask not empty (${a0})`);
      await page.getByRole("radio", { name: "Tap a tooth" }).click();
      const v = await view(page, "lips", c0);
      const tap = v.scr({ x: truth.midX - truth.lowerCentralW * 0.6, y: truth.upperEdgeY - 60 });
      await L.T.tap(tap);
      await waitAi(page);
      await page.locator(".ai-confirm").waitFor({ timeout: 5000 });
      await page.waitForTimeout(600);
      assert((await maskOn(page, (await current(page)).toothMask)) === 0, "the proposal changed the mask before it was confirmed");
      await shot(page, "06-tap-proposal");
      await page.getByRole("button", { name: "Use this outline" }).click();
      await page.waitForTimeout(900);
      const c1 = await current(page);
      const a1 = await maskOn(page, c1.toothMask);
      assert(a1 > 300, `Tap a tooth added only ${a1} mask px`);
      await shot(page, "07-tap-applied");
      // erase the same tooth again
      await page.getByRole("radio", { name: "Erase tooth" }).click();
      await L.T.tap(tap);
      await waitAi(page);
      await page.locator(".ai-confirm").waitFor({ timeout: 5000 });
      await page.getByRole("button", { name: "Use this outline" }).click();
      await page.waitForTimeout(900);
      const a2 = await maskOn(page, (await current(page)).toothMask);
      assert(a2 < a1 * 0.5, `Erase tooth left ${a2} of ${a1} px`);
      await page.getByRole("button", { name: "Undo" }).click();
      await page.waitForTimeout(900);
      const a3 = await maskOn(page, (await current(page)).toothMask);
      assert(a3 === a1, `undo after erase: ${a3} px, expected ${a1}`);
      await page.getByRole("button", { name: "Undo" }).click();
      await page.waitForTimeout(900);
      const a4 = await maskOn(page, (await current(page)).toothMask);
      assert(a4 === 0, `undo after tap: ${a4} px, expected 0`);
      // Outline all front teeth: proposal, Cancel leaves the mask as it is
      await page.getByRole("radio", { name: "Paint" }).click();
      await page.getByRole("button", { name: /Outline all front teeth/ }).click();
      await waitAi(page);
      await page.locator(".ai-confirm").waitFor({ timeout: 8000 });
      await shot(page, "08-front-teeth-proposal");
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.waitForTimeout(700);
      assert((await maskOn(page, (await current(page)).toothMask)) === 0, "Cancel changed the mask");
      allReqs.push(...L.reqs);
      allErrs.push(...L.errors);
      return `tap +${a1} px, erase → ${a2} px, undo ✓`;
    } finally {
      await L.ctx.close();
    }
  });

  await test(dn, "Labs on: no request left the app origin, and the guard refuses other hosts", async () => {
    const origin = `http://127.0.0.1:${PORT}`;
    const foreign = allReqs.filter((u) => !sameOrigin(u, origin));
    assert(allReqs.some((u) => /\/models\/face_landmarker\.task/.test(u)), "the model was not served from the app origin");
    assert(foreign.length === 0, `foreign requests: ${foreign.slice(0, 5).join(" ")}`);
    const L = await labsContext(browser, devName, { stub: "ok" });
    try {
      await L.page.goto(base);
      await importPhoto(L.page, face);
      await L.page.getByRole("button", { name: /Auto-detect points/ }).click();
      await L.page.locator(".ai-confirm").waitFor();
      const r = await L.page.evaluate(() => fetch("https://odml.pa.googleapis.com/v1/log", { method: "POST" }).then(() => "sent", (e) => String(e.message)));
      assert(/blocked/.test(r), `guard did not block: ${r}`);
      assert(!L.reqs.some((u) => /googleapis/.test(u)), "a request reached the network");
      return `${allReqs.length} requests, all same-origin; guard: ${r}`;
    } finally {
      await L.ctx.close();
    }
  });

  await test(dn, "no JS errors in console (Labs)", async () => {
    assert(allErrs.length === 0, allErrs.slice(0, 5).join("\n"));
  });
}

// Built app (CSP + service worker) with the beta on: wasm runs under the CSP, nothing leaves the origin,
// and the beta's files are not in the precache (cached on first use instead).
async function labsBuiltSuite(browser, face, outDir) {
  console.log(`\n# Labs on the built app :${PPORT}`);
  if (process.env.E2E_ONLY_LABS || !fs.existsSync(path.join(outDir, "index.html")))
    execFileSync(VITE, ["build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], { cwd: APP, stdio: "inherit" });
  const srv = await startServer(["preview", "--outDir", outDir], PPORT);
  const origin = `http://127.0.0.1:${PPORT}`;
  const { defaultBrowserType, ...dev } = devices["Pixel 7"];
  const ctx = await browser.newContext({ ...dev });
  const page = await ctx.newPage();
  const reqs = [];
  const errs = [];
  page.on("request", (r) => reqs.push(r.url()));
  page.on("console", (m) => m.type() === "error" && !mpNoise(m.text()) && errs.push(m.text()));
  page.on("pageerror", (e) => errs.push(String(e)));
  await test("Pixel 7 (built) · labs", "built app: Labs files are not precached; flag on → detection runs under the CSP, same origin only, cached on use", async () => {
    const sw = fs.readFileSync(path.join(outDir, "sw.js"), "utf8");
    assert(!/models\/|assets\/labs-/.test(sw.slice(sw.indexOf("const SHELL"), sw.indexOf("];", sw.indexOf("const SHELL")))), "Labs files are in the precache list");
    const csp = fs.readFileSync(path.join(outDir, "index.html"), "utf8").match(/Content-Security-Policy" content="([^"]+)"/)[1];
    assert(/script-src 'self' 'wasm-unsafe-eval';/.test(csp) && /connect-src 'self';/.test(csp) && !/https?:/.test(csp), `CSP: ${csp}`);
    await page.goto(origin + "/");
    await page.getByRole("heading", { name: /Design the smile/ }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(500);
    assert(reqs.filter(isLabsReq).length === 0, `flag off, built: Labs files requested ${reqs.filter(isLabsReq).join(" ")}`);
    await page.evaluate((k) => localStorage.setItem(k, "1"), LABS_KEY);
    await page.reload();
    await importPhoto(page, face);
    await page.getByRole("button", { name: /Auto-detect points/ }).click();
    await waitAi(page);
    const ok = await page.locator(".ai-confirm").isVisible();
    const t = ok ? "" : await toastText(page);
    assert(ok || /No face found/.test(t), `built app: no proposal ("${t}")`);
    const foreign = reqs.filter((u) => !sameOrigin(u, origin));
    assert(foreign.length === 0, `foreign requests: ${foreign.join(" ")}`);
    const cached = await page.evaluate(async () => {
      const out = {};
      for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname);
      return out;
    });
    const labsCache = Object.keys(cached).find((k) => k.startsWith("smile-studio-labs-"));
    assert(labsCache && cached[labsCache].some((p) => p.endsWith("face_landmarker.task")), `model not cached on use: ${JSON.stringify(Object.keys(cached))}`);
    assert(errs.length === 0, errs.slice(0, 3).join("\n"));
    return `${ok ? "proposal shown" : "no face"}; labs cache ${cached[labsCache].length} files`;
  });
  await ctx.close();
  stopServer(srv);
  await sleep(300);
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
  const bite = path.join(TMP, "bite.jpg");
  const truth = JSON.parse(execFileSync("python3", [path.join(__dirname, "make_bite.py"), bite, "1200", "800"]).toString());

  const browser = await chromium.launch({ headless: !process.env.E2E_HEADED, args: ["--enable-unsafe-swiftshader"] });
  try {
    await startServer([], PORT);
    const only = process.env.E2E_ONLY_LABS;
    for (const d of DEVICES) {
      assert(devices[d], `unknown device ${d}`);
      if (!process.env.E2E_ONLY_BITE && !only) await deviceSuite(browser, d, face);
      if (!only) await biteSuite(browser, d, bite, truth);
    }
    // round 7 Labs beta (flag off + on): phone and tablet
    for (const d of LABS_DEVICES) await labsSuite(browser, d, face, bite, truth);
    stopAll();
    if (!process.env.E2E_SKIP_OFFLINE) {
      if (!only) await offlineSuite(browser, face);
      await labsBuiltSuite(browser, face, path.join(TMP, "dist"));
    }
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
