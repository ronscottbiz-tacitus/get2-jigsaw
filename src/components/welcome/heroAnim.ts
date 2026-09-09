/**
 * Pure maths for the hero's continuous loop.
 *
 * Every piece starts **solved** in its own hole, showing the slice of the
 * backdrop video that belongs there. The loop is:
 *
 *   assembled hold
 *   → scatter outward to the OPPOSITE side of the frame (staggered, easeOutCubic)
 *   → scattered hold
 *   → fly back in across the whole frame, rotating home through 90° steps with a
 *     spring bounce (the same `steppedAngle` curve Moderate difficulty uses)
 *   → resolved hold
 *   → (loop)
 *
 * A piece is at its slot, rotation 0, scale 1 at BOTH the end of the resolved
 * hold and the start of the next assembled hold, so the wrap is seamless.
 *
 * The video crop each piece carries is always sampled at `slot` (its landing
 * hole), never its current position, so a landed piece blends into the backdrop.
 */
import { buildEdge, randEdgeParams } from '../../game/geometry';

// ---- loop timeline (ms) ------------------------------------------------
// Tuned against a busyness sweep of the running hero (fraction of the frame
// covered by pieces over the loop). 9400 → 7500: the assembled + scattered
// holds and the scatter-out are tightened to cut the "empty frame" stretch,
// while the fly-in keeps a full ~2.8s so the stepped 90° rotation reads clearly
// even for 4-quarter-turn pieces (~700ms per step).
export const HERO_HOLD1_END = 1100; // assembled hold
export const HERO_SCATTER_END = 2700; // pieces have reached the far side
export const HERO_GATHER_START = 3300; // begin flying home (brief scattered beat)
export const HERO_GATHER_END = 6100; // pieces are back in their holes, upright
export const HERO_TOTAL = 7500; // + a resolved hold, then the loop wraps
export const HERO_COPY_AT = 400; // headline fades in and stays

export const HERO_PIECE_COUNT = 11;

// ---- easing ----------------------------------------------------------
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Stepped 90° rotation with a spring bounce at the end of each quarter-turn —
 * the Moderate-difficulty rotation feel. `steps` quarter-turns from `startAngle`
 * down to `startAngle - steps*90` over t∈[0,1]; each step turns in its first 60%
 * then holds with a `sin` bounce. Returns the current angle and a scale that
 * pulses ~1.1 on each snap and settles to 1.
 * (Shared with the "Rotation changes everything." demo — imported there.)
 */
export function steppedAngle(t: number, startAngle = 270, steps = 3) {
  const segT = Math.min(steps, t * steps);
  const step = Math.min(steps - 1, Math.floor(segT));
  const localT = segT - step;
  const turnPortion = 0.6;
  let angleFrac: number;
  let bounce = 0;
  if (localT < turnPortion) angleFrac = easeOutCubic(localT / turnPortion);
  else {
    angleFrac = 1;
    const p = (localT - turnPortion) / (1 - turnPortion);
    bounce = Math.sin(p * Math.PI) * 0.1;
  }
  return { rotation: startAngle - (step + angleFrac) * 90, scale: 1 + bounce };
}

/** deterministic per-index PRNG so scatter targets never change between frames. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function heroPieceShape(w: number, h: number): string {
  const pad = 25;
  const cellW = w - 2 * pad;
  const cellH = h - 2 * pad;
  const TL = { x: pad, y: pad };
  const TR = { x: pad + cellW, y: pad };
  const BR = { x: pad + cellW, y: pad + cellH };
  const BL = { x: pad, y: pad + cellH };
  const e1 = randEdgeParams();
  const e2 = randEdgeParams();
  const e3 = randEdgeParams();
  const e4 = randEdgeParams();
  const d =
    buildEdge(TL, TR, false, e1.dir === 1, e1) +
    buildEdge(TR, BR, false, e2.dir === 1, e2) +
    buildEdge(BR, BL, false, e3.dir === 1, e3) +
    buildEdge(BL, TL, false, e4.dir === 1, e4);
  return `M ${TL.x} ${TL.y} ${d} Z`;
}

export interface HeroPieceDef {
  slot: { left: number; top: number };
  /** fly-in origin — the far side of the frame, opposite this piece's hole. */
  scatter: { left: number; top: number };
  /** quarter-turns (1–4) the piece rotates through on the way home. */
  steps: number;
  /** +1 / −1 — which way it spins. */
  spinDir: number;
  /** stagger (ms) applied to both the scatter-out and the fly-in legs. */
  delay: number;
  w: number;
  h: number;
  clip: string;
}

/**
 * Slot centres as fractions of the rendered hero box. Six are carried over from
 * the original port; five more (marked NEW) fill the gaps around the frame so
 * the assembled state reads as a real jigsaw. All of them steer clear of the
 * centre band where the headline + CTA sit (roughly fx 0.30–0.70, fy 0.34–0.66).
 */
const CENTERS = [
  { fx: 0.187, fy: 0.166 },
  { fx: 0.5, fy: 0.085 },
  { fx: 0.78, fy: 0.24 },
  { fx: 0.12, fy: 0.86 },
  { fx: 0.93, fy: 0.629 },
  { fx: 0.88, fy: 0.86 },
  { fx: 0.055, fy: 0.4 }, // NEW — far-left mid
  { fx: 0.965, fy: 0.2 }, // NEW — far-right upper
  { fx: 0.35, fy: 0.9 }, // NEW — lower, left of centre
  { fx: 0.63, fy: 0.905 }, // NEW — lower, right of centre
  { fx: 0.315, fy: 0.055 }, // NEW — top band, left of centre
];

let _shapes: string[] | null = null;
function shapes(): string[] {
  if (!_shapes)
    _shapes = Array.from({ length: CENTERS.length }, () => heroPieceShape(150, 140));
  return _shapes;
}

export function getHeroPieceDefs(heroW: number, heroH: number): HeroPieceDef[] {
  const w = 150;
  const h = 140;
  const shp = shapes();
  const cx = heroW / 2;
  const cy = heroH / 2;
  const spread = Math.max(heroW, heroH);
  const halfDiag = Math.hypot(heroW, heroH) / 2;

  return CENTERS.map((c, i) => {
    const slot = {
      left: Math.round(c.fx * heroW - w / 2),
      top: Math.round(c.fy * heroH - h / 2),
    };
    const scx = slot.left + w / 2;
    const scy = slot.top + h / 2;
    const r = mulberry32(0x9e3779b9 ^ (i * 2654435761));

    // fly-in origin: from the frame centre, head AWAY from the slot (i.e. toward
    // the opposite side) and keep going past the far corner — maximises travel.
    let ux = cx - scx;
    let uy = cy - scy;
    const d2c = Math.hypot(ux, uy) || 1;
    ux /= d2c;
    uy /= d2c;
    const outDist = halfDiag * (1.14 + r() * 0.34); // past the opposite corner
    const jitter = (r() - 0.5) * spread * 0.28; // perpendicular variety
    const scatter = {
      left: Math.round(cx + ux * outDist + -uy * jitter - w / 2),
      top: Math.round(cy + uy * outDist + ux * jitter - h / 2),
    };

    const steps = 1 + Math.floor(r() * 4); // 1..4 quarter-turns
    const spinDir = r() < 0.5 ? 1 : -1;

    // outer holes lead, inner holes trail — an "unzip from the edges" feel.
    const radiusNorm = clamp01(d2c / (spread * 0.62));
    const delay = Math.round((1 - radiusNorm) * 220 + r() * 120); // ≤ ~340ms

    return { slot, scatter, steps, spinDir, delay, w, h, clip: shp[i] };
  });
}

export interface HeroPieceState {
  visible: boolean;
  left: number;
  top: number;
  rot: number;
  scale: number;
  w: number;
  h: number;
  clip: string;
  /**
   * The video region this piece reveals is always sampled at its landing slot —
   * never its current position — so the sliver it carries matches exactly where
   * it comes to rest (and blends seamlessly into the backdrop video there).
   */
  slotLeft: number;
  slotTop: number;
}

export function heroPieceAt(def: HeroPieceDef, e: number): HeroPieceState {
  const base = {
    visible: true,
    w: def.w,
    h: def.h,
    clip: def.clip,
    slotLeft: def.slot.left,
    slotTop: def.slot.top,
  };
  const atSlot: HeroPieceState = {
    ...base,
    left: def.slot.left,
    top: def.slot.top,
    rot: 0,
    scale: 1,
  };
  const spunAngle = def.spinDir * def.steps * 90; // orientation while scattered

  // A — assembled hold
  if (e < HERO_HOLD1_END) return atSlot;

  // B — scatter outward to the far side (staggered, decelerating). Rotation
  // tumbles smoothly up to the scattered orientation.
  if (e < HERO_SCATTER_END) {
    const dur = Math.max(1, HERO_SCATTER_END - HERO_HOLD1_END - def.delay);
    const t = clamp01((e - HERO_HOLD1_END - def.delay) / dur);
    const k = easeOutCubic(t);
    return {
      ...base,
      left: lerp(def.slot.left, def.scatter.left, k),
      top: lerp(def.slot.top, def.scatter.top, k),
      rot: lerp(0, spunAngle, k),
      scale: 1,
    };
  }

  // C — scattered hold
  if (e < HERO_GATHER_START) {
    return {
      ...base,
      left: def.scatter.left,
      top: def.scatter.top,
      rot: spunAngle,
      scale: 1,
    };
  }

  // D — fly home across the frame: position eases in (easeOutCubic), rotation
  // steps down to 0 through `steps` quarter-turns with the Moderate spring
  // bounce, so the piece snaps upright as it drops into its hole.
  if (e < HERO_GATHER_END) {
    const dur = Math.max(1, HERO_GATHER_END - HERO_GATHER_START - def.delay);
    const t = clamp01((e - HERO_GATHER_START - def.delay) / dur);
    const kPos = easeOutCubic(t);
    const sr = steppedAngle(t, def.steps * 90, def.steps);
    return {
      ...base,
      left: lerp(def.scatter.left, def.slot.left, kPos),
      top: lerp(def.scatter.top, def.slot.top, kPos),
      rot: def.spinDir * sr.rotation,
      scale: sr.scale,
    };
  }

  // E — resolved hold, until the loop wraps back to A (same pose → no jump)
  return atSlot;
}

/** The breathing hole outline shows while its piece is away from home — it
 * fades out just before the piece seats so the two never fight. */
export function heroSlotVisibleAt(def: HeroPieceDef, e: number): boolean {
  const gone = HERO_HOLD1_END + def.delay + 100;
  const back = HERO_GATHER_END - 350;
  return e > gone && e < back;
}
