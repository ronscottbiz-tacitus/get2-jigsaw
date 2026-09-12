/**
 * Pure maths for "Rotation changes everything." — section 2 of the marketing
 * page. This is the effect that used to live in the hero at the top of the
 * page: a real, playing `<video>` (jellyfish.mp4) as the full-bleed backdrop,
 * with eleven puzzle pieces running one continuous loop.
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
 *     (`steppedAngle` with punchier options, shared with the hero grid's own
 *     fly-in via `heroAnim.ts`)
 *   → resolved hold
 *   → (loop)
 *
 * A piece is at its slot, rotation 0, scale 1 at BOTH the end of the resolved
 * hold and the start of the next assembled hold, so the wrap is seamless.
 *
 * The video crop each piece carries is always sampled at `slot` (its landing
 * hole), never its current position, so a landed piece blends seamlessly into
 * the backdrop.
 */
import { buildEdge, randEdgeParams } from '../../game/geometry';
import {
  easeInOutCubic,
  easeInOutSine,
  lerp,
  mulberry32,
  scatterTarget,
  steppedAngle,
  type SteppedOpts,
} from './heroAnim';

// ---- loop timeline (ms) ------------------------------------------------
// The fly-in window is long AND its easing (easeInOutSine) is near-linear, so
// the *perceived* travel time ≈ the window: a piece is visibly crossing the
// frame for ~3.5s, not front-loading 90% of the distance into the first second.
// Loop total ~11.3s.
export const ROTATION_HOLD1_END = 1100; // assembled hold
export const ROTATION_SCATTER_END = 3500; // pieces have reached the far side (2.4s out)
export const ROTATION_GATHER_START = 4200; // begin flying home (brief scattered beat)
export const ROTATION_GATHER_END = 9800; // pieces are back in their holes, upright (5.6s in)
export const ROTATION_TOTAL = 11300; // + a resolved hold, then the loop wraps

/** Wall-clock per 90° step on the fly-in — constant regardless of how many
 * quarter-turns a piece does, so every snap has the same tempo. */
export const ROTATION_STEP_MS = 750;

export const ROTATION_PIECE_COUNT = 11;

/** Punchy snap options for the fly-in: fast turn, 14° overshoot held briefly at
 * the peak, and a ~1.18 scale pop. */
export const ROTATION_SNAP: SteppedOpts = {
  turnPortion: 0.42,
  overshoot: 0.155,
  scalePulse: 0.18,
  hold: 0.28,
};

export function rotationPieceShape(w: number, h: number): string {
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

export interface RotationPieceDef {
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
 * Slot centres as fractions of the rendered frame. Six are carried over from
 * the original port; five more fill the gaps around the frame so the assembled
 * state reads as a real jigsaw. All of them steer clear of the centre band
 * where the "Rotation changes everything." heading sits (roughly
 * fx 0.30–0.70, fy 0.34–0.66).
 */
const ROTATION_CENTERS = [
  { fx: 0.187, fy: 0.166 },
  { fx: 0.5, fy: 0.085 },
  { fx: 0.78, fy: 0.24 },
  { fx: 0.12, fy: 0.86 },
  { fx: 0.93, fy: 0.629 },
  { fx: 0.88, fy: 0.86 },
  { fx: 0.055, fy: 0.4 },
  { fx: 0.965, fy: 0.2 },
  { fx: 0.35, fy: 0.9 },
  { fx: 0.63, fy: 0.905 },
  { fx: 0.315, fy: 0.055 },
];

let _shapes: string[] | null = null;
function shapes(): string[] {
  if (!_shapes)
    _shapes = Array.from({ length: ROTATION_CENTERS.length }, () => rotationPieceShape(150, 140));
  return _shapes;
}

export function getRotationPieceDefs(frameW: number, frameH: number): RotationPieceDef[] {
  const w = 150;
  const h = 140;
  const shp = shapes();
  const cx = frameW / 2;
  const cy = frameH / 2;
  const spread = Math.max(frameW, frameH);

  return ROTATION_CENTERS.map((c, i) => {
    const slot = {
      left: Math.round(c.fx * frameW - w / 2),
      top: Math.round(c.fy * frameH - h / 2),
    };
    const scx = slot.left + w / 2;
    const scy = slot.top + h / 2;
    const r = mulberry32(0x9e3779b9 ^ (i * 2654435761));

    const scatter = scatterTarget(scx, scy, cx, cy, w, h, spread, r);

    const steps = 1 + Math.floor(r() * 4); // 1..4 quarter-turns
    const spinDir = r() < 0.5 ? 1 : -1;

    // outer holes lead, inner holes trail — an "unzip from the edges" feel.
    const d2c = Math.hypot(scx - cx, scy - cy);
    const radiusNorm = Math.min(1, Math.max(0, d2c / (spread * 0.62)));
    const delay = Math.round((1 - radiusNorm) * 220 + r() * 120); // ≤ ~340ms

    return { slot, scatter, steps, spinDir, delay, w, h, clip: shp[i] };
  });
}

export interface RotationPieceState {
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

export function rotationPieceAt(def: RotationPieceDef, e: number): RotationPieceState {
  const base = {
    visible: true,
    w: def.w,
    h: def.h,
    clip: def.clip,
    slotLeft: def.slot.left,
    slotTop: def.slot.top,
  };
  const atSlot: RotationPieceState = {
    ...base,
    left: def.slot.left,
    top: def.slot.top,
    rot: 0,
    scale: 1,
  };
  const spunAngle = def.spinDir * def.steps * 90; // orientation while scattered

  // A — assembled hold
  if (e < ROTATION_HOLD1_END) return atSlot;

  // B — scatter outward to the far side. easeInOutCubic (not easeOut) so the
  // piece lifts gently out of its hole instead of snapping away — the long
  // travel then reads as deliberate. Rotation tumbles smoothly to the spun
  // orientation over the same curve.
  if (e < ROTATION_SCATTER_END) {
    const dur = Math.max(1, ROTATION_SCATTER_END - ROTATION_HOLD1_END - def.delay);
    const t = Math.min(1, Math.max(0, (e - ROTATION_HOLD1_END - def.delay) / dur));
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
  if (e < ROTATION_GATHER_START) {
    return {
      ...base,
      left: def.scatter.left,
      top: def.scatter.top,
      rot: spunAngle,
      scale: 1,
    };
  }

  // D — fly home across the frame. Position uses easeInOutSine over the whole
  // (long) window so the piece is visibly travelling for most of it rather than
  // snapping ~90% of the way home in the first second. Rotation runs on its OWN
  // fixed-tempo clock (ROTATION_STEP_MS per quarter-turn, so a 1-step and a
  // 4-step piece snap at the same speed) and finishes before the piece seats,
  // leaving a short upright glide into the hole. Each step overshoots + holds +
  // settles (ROTATION_SNAP).
  if (e < ROTATION_GATHER_END) {
    const local = e - ROTATION_GATHER_START - def.delay;
    const posDur = Math.max(1, ROTATION_GATHER_END - ROTATION_GATHER_START - def.delay);
    const kPos = easeInOutSine(Math.min(1, Math.max(0, local / posDur)));
    const tRot = Math.min(1, Math.max(0, local / (def.steps * ROTATION_STEP_MS)));
    const sr = steppedAngle(tRot, def.steps * 90, def.steps, ROTATION_SNAP);
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
export function rotationSlotVisibleAt(def: RotationPieceDef, e: number): boolean {
  const gone = ROTATION_HOLD1_END + def.delay + 100;
  const back = ROTATION_GATHER_END - 350;
  return e > gone && e < back;
}
