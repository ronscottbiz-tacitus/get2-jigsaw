/**
 * Pure maths for the hero's continuous loop.
 *
 * Every piece starts **solved** in its own hole, showing the slice of the
 * backdrop video that belongs there. The loop is:
 *
 *   assembled hold
 *   → scatter outward to the OPPOSITE side of the frame (staggered, easeInOutCubic
 *     over ~2.4s so the outward motion is deliberate, not a blur)
 *   → scattered hold
 *   → fly back in across the whole frame, rotating home through 90° steps — each
 *     step (fixed ~600ms) overshoots the target angle, holds at the peak, then
 *     settles, with a ~1.18 scale pulse, so every quarter-turn reads as a beat
 *     (`steppedAngle` with punchier options; the plain curve is still what the
 *     Moderate rotation demo uses)
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
// Scatter-out is deliberately slow (~2.4s) so 11 pieces crossing to the far
// corner read as a considered move, not a blur; the fly-in has room for
// per-step overshoot + hold. Loop total 8600ms.
export const HERO_HOLD1_END = 1100; // assembled hold
export const HERO_SCATTER_END = 3500; // pieces have reached the far side (2.4s out)
export const HERO_GATHER_START = 4200; // begin flying home (brief scattered beat)
export const HERO_GATHER_END = 7200; // pieces are back in their holes, upright
export const HERO_TOTAL = 8600; // + a resolved hold, then the loop wraps
export const HERO_COPY_AT = 400; // headline fades in and stays

/** Wall-clock per 90° step on the fly-in — constant regardless of how many
 * quarter-turns a piece does, so every snap has the same tempo. */
export const HERO_STEP_MS = 600;

export const HERO_PIECE_COUNT = 11;

// ---- easing ----------------------------------------------------------
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Bump 0→1→0 over p∈[0,1] with a flat hold at the peak: `attack` rises
 * (raised-cosine), `hold` stays at 1, the rest decays with a soft shoulder.
 * Used to shape the per-step overshoot so the eye can register each beat. */
function snapBump(p: number, attack: number, hold: number): number {
  if (p <= 0 || p >= 1) return 0;
  if (p < attack) return 0.5 - 0.5 * Math.cos((Math.PI * p) / attack);
  if (p < attack + hold) return 1;
  const q = (p - attack - hold) / (1 - attack - hold);
  return Math.pow(1 - q, 1.4);
}

export interface SteppedOpts {
  /** fraction of each step spent turning (rest is the settle). */
  turnPortion?: number;
  /** rotational overshoot past the target, as a fraction of 90° (0 = none). */
  overshoot?: number;
  /** peak scale pulse above 1. */
  scalePulse?: number;
  /** fraction of the settle held at the overshoot peak (0 = plain sin bounce). */
  hold?: number;
}

/**
 * Stepped 90° rotation — the Moderate-difficulty rotation feel. `steps`
 * quarter-turns from `startAngle` down to `startAngle - steps*90` over t∈[0,1].
 * Each step turns in its first `turnPortion`, then settles.
 *
 * With defaults it's the plain curve (turn, then a small `sin` scale bounce) —
 * that's what the "Rotation changes everything." demo uses. Pass options for a
 * punchier snap: `overshoot` rotates past the target and springs back, `hold`
 * lingers at that peak, `scalePulse` sets the size of the scale pop.
 */
export function steppedAngle(
  t: number,
  startAngle = 270,
  steps = 3,
  opts: SteppedOpts = {},
) {
  const turnPortion = opts.turnPortion ?? 0.6;
  const overshoot = opts.overshoot ?? 0;
  const scalePulse = opts.scalePulse ?? 0.1;
  const hold = opts.hold ?? 0;

  const segT = Math.min(steps, t * steps);
  const step = Math.min(steps - 1, Math.floor(segT));
  const localT = segT - step;

  if (localT < turnPortion) {
    const angleFrac = easeOutCubic(localT / turnPortion);
    return { rotation: startAngle - (step + angleFrac) * 90, scale: 1 };
  }
  const p = (localT - turnPortion) / (1 - turnPortion); // 0..1 across the settle
  const shaped =
    hold > 0 ? snapBump(p, 0.2, hold) : Math.sin(p * Math.PI);
  const angleFrac = 1 + overshoot * shaped; // >1 → past the target, springs back
  return {
    rotation: startAngle - (step + angleFrac) * 90,
    scale: 1 + scalePulse * shaped,
  };
}

/** Punchy snap options for the hero fly-in: fast turn, 14° overshoot held
 * briefly at the peak, and a ~1.18 scale pop. */
export const HERO_SNAP: SteppedOpts = {
  turnPortion: 0.42,
  overshoot: 0.155,
  scalePulse: 0.18,
  hold: 0.28,
};

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

  // B — scatter outward to the far side. easeInOutCubic (not easeOut) so the
  // piece lifts gently out of its hole instead of snapping away — the long
  // travel then reads as deliberate. Rotation tumbles smoothly to the spun
  // orientation over the same curve.
  if (e < HERO_SCATTER_END) {
    const dur = Math.max(1, HERO_SCATTER_END - HERO_HOLD1_END - def.delay);
    const t = clamp01((e - HERO_HOLD1_END - def.delay) / dur);
    const k = easeInOutCubic(t);
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

  // D — fly home across the frame. Position eases straight in over the whole
  // window; rotation runs on its OWN fixed-tempo clock (HERO_STEP_MS per
  // quarter-turn, so a 1-step and a 4-step piece snap at the same speed) and
  // finishes before the piece seats, leaving a short upright glide into the
  // hole. Each step overshoots + holds + settles (HERO_SNAP).
  if (e < HERO_GATHER_END) {
    const local = e - HERO_GATHER_START - def.delay;
    const posDur = Math.max(1, HERO_GATHER_END - HERO_GATHER_START - def.delay);
    const kPos = easeOutCubic(clamp01(local / posDur));
    const tRot = clamp01(local / (def.steps * HERO_STEP_MS));
    const sr = steppedAngle(tRot, def.steps * 90, def.steps, HERO_SNAP);
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
