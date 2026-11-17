// Switching a design between the upper and the lower arch (UI side; geometry for each arch lives in the engine).
import { centralLength, designAngle, toImage } from "./geometry";
import { DEFAULT_DESIGN, type Arch, type Design, type Guides } from "./model";

/** Lower central W/L ≈ 5.3 / 8.5 mm (docs/round3-clinical.md A, textbook, no PMID). */
export const WL_LOWER_DEFAULT = 0.62;
/** Lower canine-to-canine perceived span ≈ 0.79 × upper span (derived, docs/round3-clinical.md A). */
export const LOWER_SPAN = 0.79;

export const archOf = (d: Design): Arch => d.arch ?? "upper";

/**
 * The same design re-laid for the other arch: lower is narrower (0.79 × span), its central W/L defaults to 0.62,
 * and its incisal edge starts a little above the upper one (lower incisal edges sit behind the upper incisal third).
 * Switching back restores the upper proportions. Shape, proportion, count and shade are kept (lower shade linked to upper).
 */
export function withArch(d: Design, g: Guides, arch: Arch): Design {
  if (archOf(d) === arch) return d;
  const a = designAngle(d, g);
  const L = centralLength(d);
  if (arch === "lower") {
    const center = toImage({ x: 0, y: -0.2 * L }, d, a);
    return { ...d, arch, center, width: d.width * LOWER_SPAN, wl: WL_LOWER_DEFAULT };
  }
  const center = toImage({ x: 0, y: 0.2 * L }, d, a);
  return { ...d, arch, center, width: d.width / LOWER_SPAN, wl: DEFAULT_DESIGN.wl };
}
