// ffmpeg toolkit for clinic footage. Usage: npm run ff -- <recipe> [args]   (npm run ff -- help)
// Every recipe writes H.264 yuv420p (or the stated format) and never overwrites its input.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const V = ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
const A = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"];
const ff = (...args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const hasAudio = (f: string) =>
  execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", f], { encoding: "utf8" }).trim()
    .length > 0;
const duration = (f: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }));
const opt = (args: string[], name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const pos = (args: string[]) => args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
function guard(inp: string, out: string) {
  if (!inp || !out) throw new Error("missing input or output path (npm run ff -- help)");
  if (!existsSync(inp)) throw new Error(`not found: ${inp}`);
  if (resolve(inp) === resolve(out)) throw new Error("output must differ from input");
}

export const GRADES: Record<string, string> = {
  neutral: "eq=contrast=1.04:saturation=1.0",
  warm: "colorbalance=rs=0.04:bs=-0.04:rm=0.03:bm=-0.03,eq=saturation=1.05",
  clinical: "colorbalance=rs=-0.03:bs=0.03,eq=contrast=1.06:saturation=0.95:brightness=0.01", // clean, slightly cool, true whites
  "skin-fix": "colorbalance=rs=-0.08:gs=0.01:bs=0.04:rm=-0.06:bm=0.03,eq=saturation=0.88", // pulls back the red cast in our talking heads
  brand: "colorbalance=rs=0.03:bs=-0.02:rh=0.02,curves=preset=medium_contrast,eq=saturation=0.92", // warm bronze, soft contrast
  film: "curves=all='0/0.05 0.5/0.5 1/0.96',colorbalance=rh=0.03:bh=-0.03:bs=0.02,eq=saturation=0.9", // lifted blacks, warm highlights
  editorial: "curves=all='0/0.06 0.6/0.62 1/0.97',colorbalance=rm=0.02:bm=-0.03,eq=saturation=0.85", // soft cream, for the editorial theme
  "teal-orange": "colorbalance=rs=-0.06:bs=0.08:rh=0.06:bh=-0.06,eq=saturation=1.08:contrast=1.05", // punchy, offers only
};
// Automatic correction (white balance from neutral pixels + levels, then a look): python3 scripts/autograde.py <in> <out> --look brand

const recipes: Record<string, { help: string; run: (a: string[]) => void }> = {
  reframe: {
    help: "reframe <in> <out> [--mode blur|crop]   any aspect → 1080×1920 (blur: whole frame over a blurred fill; crop: centre crop)",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      const vf =
        opt(a, "mode", "blur") === "crop"
          ? "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
          : "split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.08[bg];[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1";
      ff("-i", inp, "-filter_complex", vf, ...V, ...(hasAudio(inp) ? A : ["-an"]), out);
    },
  },
  stabilize: {
    help: "stabilize <in> <out> [--smooth 20]       two-pass vidstab for hand-held phone footage",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      const dir = mkdtempSync(join(tmpdir(), "vidstab-"));
      const trf = join(dir, "t.trf");
      ff("-i", inp, "-vf", `vidstabdetect=shakiness=6:accuracy=12:result=${trf}`, "-f", "null", "-");
      ff("-i", inp, "-vf", `vidstabtransform=input=${trf}:smoothing=${opt(a, "smooth", "20")}:zoom=2:optzoom=1,unsharp=5:5:0.6`, ...V, ...(hasAudio(inp) ? ["-c:a", "copy"] : []), out);
      rmSync(dir, { recursive: true, force: true });
    },
  },
  denoise: {
    help: "denoise <in> <out> [--strength 4]        video grain (hqdn3d) + audio hiss (afftdn) for low-light clinic shots",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      const s = Number(opt(a, "strength", "4"));
      ff("-i", inp, "-vf", `hqdn3d=${s}:${s * 0.75}:${s * 1.5}:${s * 1.1}`, ...(hasAudio(inp) ? ["-af", "afftdn=nf=-25", ...A] : ["-an"]), ...V, out);
    },
  },
  "clean-audio": {
    help: "clean-audio <in> <out>                   speech clean-up: rumble cut, hiss reduction, gentle compression, −14 LUFS (video copied)",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      ff("-i", inp, "-c:v", "copy", "-af", "highpass=f=80,lowpass=f=12000,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=10:release=200,loudnorm=I=-14:TP=-1.5:LRA=11", ...A, out);
    },
  },
  grade: {
    help: `grade <in> <out> [--preset ${Object.keys(GRADES).join("|")}] [--lut file.cube]   colour grade (a LUT wins if given)`,
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      const lut = opt(a, "lut");
      const vf = lut ? `lut3d=file='${lut}'` : GRADES[opt(a, "preset", "neutral")!];
      if (!vf) throw new Error(`unknown preset; use ${Object.keys(GRADES).join(", ")}`);
      ff("-i", inp, "-vf", vf, ...V, ...(hasAudio(inp) ? ["-c:a", "copy"] : ["-an"]), out);
    },
  },
  "auto-grade": {
    help: "auto-grade <in> <out> [--look brand|film|editorial|…] [--strength 1]   white balance + levels from the footage itself, then a look",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      execFileSync("python3", ["scripts/autograde.py", inp, out, "--look", opt(a, "look", "none")!, "--strength", opt(a, "strength", "1")!], { stdio: "inherit" });
    },
  },
  cleanup: {
    help: "cleanup <in> <out> --box x,y,w,h [--mode plate|inpaint|blur] [--from s --to s]   remove/blur something in a box (blur for privacy)",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      const extra = a.filter((x, i) => ["--box", "--mode", "--from", "--to", "--feather"].includes(a[i - 1] ?? "") || ["--box", "--mode", "--from", "--to", "--feather"].includes(x));
      execFileSync("python3", ["scripts/cleanup.py", inp, out, ...extra], { stdio: "inherit" });
    },
  },
  kenburns: {
    help: "kenburns <image> <out> [--seconds 5] [--zoom 1.15] [--focus 0.5,0.45]   slow push-in on a still (never on clinical before/after)",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      const sec = Number(opt(a, "seconds", "5")), z = Number(opt(a, "zoom", "1.15"));
      const [fx, fy] = opt(a, "focus", "0.5,0.45")!.split(",").map(Number);
      const n = Math.round(sec * 30);
      ff("-loop", "1", "-i", inp, "-vf",
        `scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='1+(${z}-1)*on/${n}':x='(iw-iw/zoom)*${fx}':y='(ih-ih/zoom)*${fy}':d=${n}:s=1080x1920:fps=30`,
        "-t", String(sec), ...V, "-an", out);
    },
  },
  speed: {
    help: "speed <in> <out> --factor 2              speed up / slow down (0.25–4); audio pitch kept",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      const f = Number(opt(a, "factor", "2"));
      const at: string[] = [];
      for (let r = f; Math.abs(r - 1) > 1e-4; ) {
        const s = Math.min(2, Math.max(0.5, r));
        at.push(`atempo=${s}`);
        r /= s;
      }
      ff("-i", inp, "-vf", `setpts=PTS/${f}`, ...(hasAudio(inp) ? ["-af", at.join(",") || "anull", ...A] : ["-an"]), ...V, out);
    },
  },
  gif: {
    help: "gif <in> <out.gif> [--fps 12] [--width 540]   high-quality GIF (palette) for WhatsApp / web",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      const f = `fps=${opt(a, "fps", "12")},scale=${opt(a, "width", "540")}:-1:flags=lanczos`;
      ff("-i", inp, "-filter_complex", `${f},split[x][y];[x]palettegen=stats_mode=diff[p];[y][p]paletteuse=dither=bayer:bayer_scale=4`, out);
    },
  },
  frames: {
    help: "frames <in> <dir> [--every 1]            export JPG frames every N seconds (review, carousel posts)",
    run: (a) => {
      const [inp, dir] = pos(a);
      mkdirSync(dir, { recursive: true });
      ff("-i", inp, "-vf", `fps=1/${opt(a, "every", "1")}`, "-q:v", "2", join(dir, "frame-%03d.jpg"));
    },
  },
  thumb: {
    help: "thumb <in> <out.jpg> [--at 1.5]          single still (cover image)",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      ff("-ss", opt(a, "at", "1.5")!, "-i", inp, "-frames:v", "1", "-q:v", "2", out);
    },
  },
  concat: {
    help: "concat <out> <in1> <in2> … [--xfade 0.4]   join clips (normalised to 1080×1920 30 fps), optional crossfade seconds",
    run: (a) => {
      const [out, ...ins] = pos(a);
      if (ins.length < 2) throw new Error("concat needs an output and at least two inputs");
      const x = Number(opt(a, "xfade", "0"));
      const norm = ins.map((_, i) => `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1,format=yuv420p[v${i}]`);
      const audio = ins.every(hasAudio);
      let chain = "", last = "v0", alast = "0:a", t = duration(ins[0]);
      if (x > 0) {
        for (let i = 1; i < ins.length; i++) {
          chain += `;[${last}][v${i}]xfade=transition=fade:duration=${x}:offset=${(t - x).toFixed(3)}[x${i}]`;
          if (audio) chain += `;[${alast}][${i}:a]acrossfade=d=${x}[a${i}]`;
          last = `x${i}`;
          alast = `a${i}`;
          t += duration(ins[i]) - x;
        }
      } else {
        chain = `;${ins.map((_, i) => `[v${i}]${audio ? `[${i}:a]` : ""}`).join("")}concat=n=${ins.length}:v=1:a=${audio ? 1 : 0}[cv]${audio ? "[ca]" : ""}`;
        last = "cv";
        alast = "ca";
      }
      ff(...ins.flatMap((f) => ["-i", f]), "-filter_complex", norm.join(";") + chain, "-map", `[${last}]`, ...(audio ? ["-map", `[${alast}]`, ...A] : ["-an"]), ...V, out);
    },
  },
  "burn-subs": {
    help: "burn-subs <in> <subs.srt> <out>          hard-burn captions (for platforms without caption support)",
    run: (a) => {
      const [inp, srt, out] = pos(a);
      guard(inp, out);
      const style = "FontName=Oswald,FontSize=15,PrimaryColour=&H00F6F8F7,OutlineColour=&H00201C1C,BorderStyle=1,Outline=1.6,Shadow=0,MarginV=120,Alignment=2";
      ff("-i", inp, "-vf", `subtitles='${srt}':fontsdir='${resolve("public/fonts")}':force_style='${style}'`, ...V, ...(hasAudio(inp) ? ["-c:a", "copy"] : []), out);
    },
  },
  compress: {
    help: "compress <in> <out> [--crf 26] [--height 1280]   smaller file for WhatsApp / web (default 720×1280)",
    run: (a) => {
      const [inp, out] = pos(a);
      guard(inp, out);
      ff("-i", inp, "-vf", `scale=-2:${opt(a, "height", "1280")}`, "-c:v", "libx264", "-preset", "slow", "-crf", opt(a, "crf", "26")!, "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        ...(hasAudio(inp) ? ["-c:a", "aac", "-b:a", "96k"] : []), out);
    },
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === "help" || !recipes[cmd]) {
    console.log("ffmpeg toolkit: npm run ff -- <recipe> …\n");
    for (const r of Object.values(recipes)) console.log("  " + r.help);
    process.exit(cmd && cmd !== "help" ? 1 : 0);
  }
  recipes[cmd].run(args);
}
