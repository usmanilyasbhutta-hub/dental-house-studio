import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clinic, video } from "../../brand";
import { carousel as P } from "../../theme";
import type { PromoBrief } from "../../brief/schema";
import outline from "../../data/pakistan-map.json";
import geo from "../../data/realmap.json";

/**
 * Real-data location map (own_map.style: real): one continuous zoom through open, ad-safe data, built by scripts/make_realmap.py.
 * NASA Blue Marble (Pakistan) → Copernicus Sentinel-2 (Sialkot, 22 Nov 2026) → OpenStreetMap streets restyled in the carousel
 * colours → the road in front of the clinic, the Dental House pin and the landmark directly opposite. No Google imagery.
 * Everything lives in local metres around the clinic pin (x east, y north); the camera is a centre + metres-per-pixel.
 */
const W = video.width, H = video.height;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = Easing.bezier(0.5, 0, 0.3, 1);

const font = (size: number, weight = 900, color: string = P.ink): React.CSSProperties => ({
  fontFamily: P.headline, fontWeight: weight, fontSize: size, color, lineHeight: 1.0, letterSpacing: weight >= 900 ? "-0.02em" : "0",
});

const L = geo.layers;
const ROAD_X = geo.road_x_at_pin; // the road's centre line at the pin's latitude (metres east of the pin)
const CLINIC = { x: ROAD_X - 26, y: 0 }; // clinic frontage, west side
const LANDMARK = { x: ROAD_X + 30, y: 0 }; // "directly opposite" (owner), east side
const V1 = 300; // final view width: the road and both buildings
const V0 = 2_300_000; // view width at the start (metres across 1080 px): all of Pakistan
const C0 = { x: (L.bluemarble.bounds[0] + L.bluemarble.bounds[2]) / 2 + 120_000, y: -276_000 };

export const RealMap: React.FC<{ brief: PromoBrief; accent: string; len: number }> = ({ brief, accent, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = brief.own_map!;
  const f = (x: number) => Math.round((x / 138) * len); // timeline authored for 138 frames, scaled to the page length

  // ---- camera: log-space zoom with a breather over Sialkot ---------------------------------------------------------------
  const lv = Math.log10;
  const z1 = interpolate(frame, [f(14), f(58)], [0, 1], { ...clamp, easing: inOut });
  const z2 = interpolate(frame, [f(58), f(68)], [0, 1], clamp);
  const z3 = interpolate(frame, [f(68), f(100)], [0, 1], { ...clamp, easing: inOut });
  const logV = lv(V0) + (lv(16_000) - lv(V0)) * z1 + (lv(12_000) - lv(16_000)) * z2 + (lv(V1) - lv(12_000)) * z3;
  const V = 10 ** logV;
  const mpp = V / W;
  const CEND = { x: ROAD_X, y: 70 * (V1 / W) }; // road on the centre line, pin a little below the middle
  const k = Math.max(0, (V - V1) / (V0 - V1)); // centre slides so the pin keeps its screen position while zooming
  const cx = CEND.x + (C0.x - CEND.x) * k, cy = CEND.y + (C0.y - CEND.y) * k;
  const sx = (x: number) => W / 2 + (x - cx) / mpp;
  const sy = (y: number) => H / 2 + (cy - y) / mpp;

  const fadeIn = (from: number, to: number) => interpolate(logV, [lv(to), lv(from)], [1, 0], clamp); // opacity rises as V shrinks
  // Each layer is a screen-sized box painting only its visible part (background-size/position), so a 2400 px image blown up
  // to 40 000 px never becomes a giant element (Chrome drops those). A hidden <Img> makes Remotion wait for the file to load.
  const layer = (b: number[], key: string, o: number, src: string | null, feather = true, child?: React.ReactNode) => {
    if (o <= 0.001) return null;
    const x = sx(b[0]), y = sy(b[3]), w = (b[2] - b[0]) / mpp, h = (b[3] - b[1]) / mpp;
    if (x > W || y > H || x + w < 0 || y + h < 0) return null;
    const pos = `${x}px ${y}px`, size = `${w}px ${h}px`;
    const mask = feather ? "radial-gradient(closest-side, black 72%, transparent 100%)" : undefined;
    return (
      <AbsoluteFill key={key} style={{ opacity: o, WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: size, maskSize: size,
        WebkitMaskPosition: pos, maskPosition: pos, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        backgroundImage: src ? `url(${staticFile(src)})` : undefined, backgroundSize: size, backgroundPosition: pos, backgroundRepeat: "no-repeat" }}>
        {src ? <Img src={staticFile(src)} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} /> : null}
        {child ? <div style={{ position: "absolute", left: x, top: y, width: w, height: h }}>{child}</div> : null}
      </AbsoluteFill>
    );
  };

  const draw = interpolate(frame, [0, f(16)], [0, 1], { ...clamp, easing: inOut });
  const outlineO = interpolate(logV, [lv(450_000), lv(1_000_000)], [0, 1], clamp);
  const wideO = fadeIn(220_000, 110_000);
  const cityO = fadeIn(34_000, 18_000);
  const streetO = fadeIn(2_800, 1_500);
  const pinX = sx(0), pinY = sy(0);
  const pulse = (frame % 24) / 24;
  const dotO = interpolate(logV, [lv(4_000), lv(9_000)], [0, 1], clamp);

  // ---- the road in front of the clinic, drawn from north to south ----------------------------------------------------------
  const road = interpolate(frame, [f(84), f(104)], [0, 1], { ...clamp, easing: inOut });
  const roadPath = "M " + geo.road.filter(([x]) => Math.abs(x - ROAD_X) < 60).map(([x, y]) => `${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(" L ");
  const roadW = Math.max(10, 10 / mpp);

  // ---- markers ------------------------------------------------------------------------------------------------------------------
  const cP = { x: sx(CLINIC.x), y: sy(CLINIC.y) }, lP = { x: sx(LANDMARK.x), y: sy(LANDMARK.y) };
  const pin = spring({ frame: frame - f(104), fps, config: { damping: 9, stiffness: 200 } });
  const tag = interpolate(frame, [f(108), f(114)], [0, 1], clamp);
  const link = interpolate(frame, [f(112), f(120)], [0, 1], { ...clamp, easing: inOut });
  const card = interpolate(frame, [f(118), f(124)], [0, 1], clamp);

  const stops = [
    { n: "01", label: m.country, a: 0, b: 36 },
    { n: "02", label: m.city, a: 38, b: 82 },
    { n: "03", label: m.road, a: 84, b: 138 },
  ];

  return (
    <AbsoluteFill style={{ background: P.paper, overflow: "hidden" }}>
      {layer(L.bluemarble.bounds, "bm", 1, L.bluemarble.src, false)}
      {layer(L.outline.bounds, "ol", outlineO, null, false, (
        <svg viewBox={`0 0 ${outline.width} ${outline.height}`} preserveAspectRatio="none" width="100%" height="100%">
          <path d={outline.paths.Pakistan} fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        </svg>
      ))}
      {layer(L.s2wide.bounds, "s2w", wideO, L.s2wide.src)}
      {layer(L.s2city.bounds, "s2c", cityO, L.s2city.src)}
      {layer(L.streets.bounds, "st", streetO, L.streets.src)}

      {/* Sialkot dot while the satellite views are on screen */}
      {dotO > 0 && streetO < 1 ? (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: dotO * (1 - streetO) }}>
          <circle cx={pinX} cy={pinY} r={12 + 34 * pulse} fill="none" stroke="#FFFFFF" strokeWidth={4} opacity={(1 - pulse) * draw} />
          <circle cx={pinX} cy={pinY} r={12} fill={accent} stroke="#FFFFFF" strokeWidth={4} opacity={draw} />
        </svg>
      ) : null}

      {/* the road, in the season accent */}
      {road > 0 ? (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <path d={roadPath} fill="none" stroke={accent} strokeOpacity={0.9} strokeWidth={roadW} strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - road} />
        </svg>
      ) : null}

      {/* stop labels, numbered like a route; a soft paper wash keeps them readable over imagery */}
      {stops.map((s, i) => {
        const o = interpolate(frame, [f(s.a), f(s.a) + 6, f(s.b) - 6, f(s.b)], [0, 1, 1, 0], clamp);
        if (o <= 0) return null;
        return (
          <div key={i} style={{ position: "absolute", left: 70, top: 270, opacity: o, transform: `translateY(${(1 - o) * 18}px)`,
            background: "rgba(251,247,240,0.92)", borderRadius: 22, padding: "16px 26px 20px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
            <div style={{ ...font(28, 500, P.bronze), letterSpacing: "0.2em" }}>{s.n}</div>
            <div style={{ ...font(96, 900), marginTop: 6 }}>{s.label}</div>
          </div>
        );
      })}

      {/* clinic pin + tag (west side of the road) */}
      <div style={{ position: "absolute", left: cP.x, top: cP.y, transform: `translate(-50%, -100%) translateY(${(1 - pin) * -120}px)`, opacity: Math.min(1, pin * 3) }}>
        <svg viewBox="0 0 24 32" style={{ width: 92, height: 122, filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.35))" }}>
          <path d="M12 31s10-11 10-19A10 10 0 0 0 2 12c0 8 10 19 10 19z" fill={accent} />
          <circle cx="12" cy="12" r="4" fill={P.paper} />
        </svg>
      </div>
      <div style={{ position: "absolute", left: Math.max(70, cP.x - 400), top: cP.y - 300, width: 440, opacity: tag,
        transform: `scale(${0.92 + 0.08 * tag})`, transformOrigin: "right bottom", background: "#FFFFFF", borderRadius: 18, padding: "16px 24px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.22)", borderLeft: `10px solid ${accent}` }}>
        <div style={font(46, 900)}>{clinic.name}</div>
        <div style={{ ...font(30, 500, P.soft), marginTop: 6 }}>{m.road}</div>
      </div>

      {/* landmark directly opposite, linked across the road */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: link > 0 ? 1 : 0 }}>
        <path d={`M ${cP.x} ${cP.y - 14} Q ${(cP.x + lP.x) / 2} ${cP.y - 110} ${lP.x} ${lP.y - 14}`}
          fill="none" stroke={P.ink} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - link} />
      </svg>
      <div style={{ position: "absolute", left: lP.x - 40, top: lP.y - 40, width: 80, height: 80, borderRadius: "50%", background: "#FFFFFF",
        border: `6px solid ${accent}`, transform: `scale(${link})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px rgba(0,0,0,0.3)" }}>
        <div style={{ position: "relative", width: 36, height: 36 }}>
          <div style={{ position: "absolute", left: 13, top: 0, width: 10, height: 36, background: accent }} />
          <div style={{ position: "absolute", left: 0, top: 13, width: 36, height: 10, background: accent }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: Math.min(Math.max(70, lP.x - 260), 940 - 560), top: lP.y + 70, width: 560, opacity: card,
        transform: `translateY(${(1 - card) * 16}px)`, background: "#FFFFFF", borderRadius: 18, padding: "18px 26px", boxShadow: "0 10px 24px rgba(0,0,0,0.22)" }}>
        <div style={{ ...font(26, 700, accent), letterSpacing: "0.14em", textTransform: "uppercase" }}>{m.landmark.relation}</div>
        <div style={{ ...font(46, 900), marginTop: 6 }}>{m.landmark.title}</div>
        {m.landmark.sub ? <div style={{ ...font(30, 500, P.soft), marginTop: 6, lineHeight: 1.15 }}>{m.landmark.sub}</div> : null}
      </div>

      {/* data credits: required by the licences, on screen the whole time */}
      <div style={{ position: "absolute", left: 70, top: 1452, maxWidth: 820, ...font(22, 500, P.ink), lineHeight: 1.3, background: "rgba(255,255,255,0.88)",
        padding: "8px 16px", borderRadius: 14 }}>
        Map data: {geo.credits.join(" · ")}
      </div>
    </AbsoluteFill>
  );
};
