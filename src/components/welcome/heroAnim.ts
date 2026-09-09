/**
 * Pure maths for the hero's continuous loop.
 *
 * Every piece starts **solved** in its own hole, showing the slice of the
 * backdrop video that belongs there. The loop is:
 *
 *   solved hold  →  scatter outward (staggered, easeOutCubic)
 *   →  scattered hold  →  gather back inward (staggered, easeOutBack settle)
 *   →  resolved hold  →  (loop)
 *
 * Because a piece is at its slot, rotation 0, at BOTH the end of the resolved
 * hold and the start of the next solved hold, the wrap is seamless — no jump.
 * The outward and inward legs use the same easing quality (cubic), mirrored.
 *
 * The video crop each piece carries is always sampled at `slot` (its landing
 * hole), never its current position, so a gathered piece blends perfectly into
 * the backdrop.
 */
import { buildEdge, randEdgeParams } from '../../game/geometry';

// ---- loop timeline (ms) ------------------------------------------------
export const HERO_HOLD1_END = 1500; // initial "assembled" hold
export const HERO_SCATTER_END = 3600; // pieces have reached their scatter point
export const HERO_GATHER_START = 5400; // begin floating home
export const HERO_GATHER_END = 7800; // pieces are back in their holes
export const HERO_TOTAL = 9400; // + a resolved hold, then the loop wraps
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
  scatter: { left: number; top: number; rot: number };
  /** stagger (ms) applied to both the scatter-out and the gather-in legs. */
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

  return CENTERS.map((c, i) => {
    const slot = {
      left: Math.round(c.fx * heroW - w / 2),
      top: Math.round(c.fy * heroH - h / 2),
    };
    // fling outward, away from the frame centre, in this piece's own direction
    const scx = slot.left + w / 2;
    const scy = slot.top + h / 2;
    let dx = scx - cx;
    let dy = scy - cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const r = mulberry32(0x9e3779b9 ^ (i * 2654435761));
    const dist = 1.05 + r() * 0.5; // 1.05–1.55 × spread
    const perpX = -dy;
    const perpY = dx;
    const jitter = (r() - 0.5) * spread * 0.45;
    const scatter = {
      left: Math.round(cx + dx * spread * dist + perpX * jitter - w / 2),
      top: Math.round(cy + dy * spread * dist + perpY * jitter - h / 2),
      rot: Math.round((r() - 0.5) * 520),
    };
    // outer pieces lead, inner pieces trail — an "unzip from the edges" feel
    const radiusNorm = clamp01(len / (spread * 0.62));
    const delay = Math.round((1 - radiusNorm) * 360 + (r() * 140));
    return { slot, scatter, delay, w, h, clip: shp[i] };
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

  // A — assembled hold
  if (e < HERO_HOLD1_END) return atSlot;

  // B — scatter outward (staggered, decelerating)
  if (e < HERO_SCATTER_END) {
    const dur = Math.max(1, HERO_SCATTER_END - HERO_HOLD1_END - def.delay);
    const t = clamp01((e - HERO_HOLD1_END - def.delay) / dur);
    const k = easeOutCubic(t);
    return {
      ...base,
      left: lerp(def.slot.left, def.scatter.left, k),
      top: lerp(def.slot.top, def.scatter.top, k),
      rot: lerp(0, def.scatter.rot, k),
      scale: 1,
    };
  }

  // C — scattered hold
  if (e < HERO_GATHER_START) {
    return {
      ...base,
      left: def.scatter.left,
      top: def.scatter.top,
      rot: def.scatter.rot,
      scale: 1,
    };
  }

  // D — gather back inward (staggered, same cubic easing as the scatter leg,
  // mirrored). A tiny scale pulse as it seats, but no positional overshoot —
  // the travel is a full frame-width, so easeOutBack here would fling the piece
  // well past its hole.
  if (e < HERO_GATHER_END) {
    const dur = Math.max(1, HERO_GATHER_END - HERO_GATHER_START - def.delay);
    const t = clamp01((e - HERO_GATHER_START - def.delay) / dur);
    const k = easeOutCubic(t);
    const seat = t > 0.82 ? Math.sin(((t - 0.82) / 0.18) * Math.PI) * 0.03 : 0;
    return {
      ...base,
      left: lerp(def.scatter.left, def.slot.left, k),
      top: lerp(def.scatter.top, def.slot.top, k),
      rot: lerp(def.scatter.rot, 0, k),
      scale: 1 + seat,
    };
  }

  // E — resolved hold, until the loop wraps back to A (same pose → no jump)
  return atSlot;
}

/** The breathing hole outline shows while its piece is away from home. */
export function heroSlotVisibleAt(def: HeroPieceDef, e: number): boolean {
  const gone = HERO_HOLD1_END + def.delay + 120;
  const back = HERO_GATHER_END + 200;
  return e > gone && e < back;
}
