/**
 * Pure maths for the hero's shatter → rotate → land → gather loop.
 * Ported from the prototype's `heroPieceShape`, `getHeroPieceDefs`,
 * `heroEaseOutCubic/Back`, `heroStepRotation`. The component just samples
 * `heroPieceAt(def, elapsed)` every frame.
 */
import { buildEdge, randEdgeParams } from '../../game/geometry';

export const HERO_TOTAL = 9600; // one full loop incl. gather-back (was 8200, +gather)
export const HERO_GATHER_START = 6400;
export const HERO_GATHER_END = 8600;
export const HERO_PIECE_COUNT = 6;
export const HERO_CELEBRATE_AT = 5550;
export const HERO_COPY_AT = 4200;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 4-step 90° rotation with a small spring bounce at each step. */
export function heroStepRotation(t: number) {
  const nSteps = 4;
  const segT = Math.min(nSteps, t * nSteps);
  const step = Math.min(nSteps - 1, Math.floor(segT));
  const localT = segT - step;
  const turnPortion = 0.6;
  let angleFrac: number;
  let bounce = 0;
  if (localT < turnPortion) {
    angleFrac = easeOutCubic(localT / turnPortion);
  } else {
    angleFrac = 1;
    const p = (localT - turnPortion) / (1 - turnPortion);
    bounce = Math.sin(p * Math.PI) * 0.12;
  }
  return { rotation: (step + angleFrac) * 90, scale: 1 + bounce };
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
  staging: { left: number; top: number };
  start: number;
  rotateEnd: number;
  landEnd: number;
  w: number;
  h: number;
  clip: string;
}

const CENTERS = [
  { fx: 0.187, fy: 0.166 },
  { fx: 0.5, fy: 0.085 },
  { fx: 0.78, fy: 0.24 },
  { fx: 0.12, fy: 0.86 },
  { fx: 0.93, fy: 0.629 },
  { fx: 0.88, fy: 0.86 },
];
const STAGING_OFFSETS = [
  { dx: -70, dy: -55 },
  { dx: 0, dy: -70 },
  { dx: 60, dy: 85 },
  { dx: -65, dy: 55 },
  { dx: -60, dy: 60 },
  { dx: 60, dy: 55 },
];
const TIMES = [
  { start: 200, rotateEnd: 2400, landEnd: 3100 },
  { start: 500, rotateEnd: 2700, landEnd: 3400 },
  { start: 900, rotateEnd: 3300, landEnd: 4050 },
  { start: 1100, rotateEnd: 3500, landEnd: 4250 },
  { start: 2000, rotateEnd: 4500, landEnd: 5300 },
  { start: 2250, rotateEnd: 4750, landEnd: 5550 },
];

let _shapes: string[] | null = null;
function shapes(): string[] {
  if (!_shapes)
    _shapes = Array.from({ length: HERO_PIECE_COUNT }, () =>
      heroPieceShape(150, 140),
    );
  return _shapes;
}

export function getHeroPieceDefs(heroW: number, heroH: number): HeroPieceDef[] {
  const w = 150;
  const h = 140;
  const shp = shapes();
  const slots = CENTERS.map((c) => ({
    left: Math.round(c.fx * heroW - w / 2),
    top: Math.round(c.fy * heroH - h / 2),
  }));
  const scatters = [
    { left: Math.round(-heroW * 0.42), top: Math.round(heroH * 0.9), rot: -55 },
    { left: Math.round(heroW * 0.5 - w / 2), top: Math.round(-heroH * 0.45), rot: 95 },
    { left: Math.round(heroW * 1.42), top: Math.round(heroH * 0.55), rot: 200 },
    { left: Math.round(-heroW * 0.45), top: Math.round(heroH * 1.35), rot: -140 },
    { left: Math.round(heroW * 1.42), top: Math.round(heroH * 1.35), rot: 130 },
    { left: Math.round(heroW * 1.45), top: Math.round(heroH * 0.92), rot: 250 },
  ];
  return slots.map((slot, i) => ({
    slot,
    scatter: scatters[i],
    staging: {
      left: slot.left + STAGING_OFFSETS[i].dx,
      top: slot.top + STAGING_OFFSETS[i].dy,
    },
    ...TIMES[i],
    w,
    h,
    clip: shp[i],
  }));
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
  /** crop anchor — always the piece's destination slot, so the revealed video
   * slice is the correct seamless crop regardless of where the piece is. */
  vLeft: number;
  vTop: number;
}

export function heroPieceAt(def: HeroPieceDef, e: number): HeroPieceState {
  const base = {
    w: def.w,
    h: def.h,
    clip: def.clip,
    vLeft: -def.slot.left,
    vTop: -def.slot.top,
  };
  if (e < def.start)
    return { ...base, visible: false, left: 0, top: 0, rot: 0, scale: 1 };

  // gather-back: after HERO_GATHER_START, float every piece from its slot back
  // out to its scatter origin with mirrored easing, then the loop wraps.
  if (e >= HERO_GATHER_START) {
    const gt = easeOutCubic(
      Math.min(1, Math.max(0, (e - HERO_GATHER_START) / (HERO_GATHER_END - HERO_GATHER_START))),
    );
    return {
      ...base,
      visible: gt < 0.999,
      left: lerp(def.slot.left, def.scatter.left, gt),
      top: lerp(def.slot.top, def.scatter.top, gt),
      rot: lerp(0, def.scatter.rot, gt),
      scale: 1,
    };
  }

  let left: number;
  let top: number;
  let rot: number;
  let scale: number;
  if (e < def.rotateEnd) {
    const t = (e - def.start) / (def.rotateEnd - def.start);
    const eased = easeOutCubic(t);
    left = lerp(def.scatter.left, def.staging.left, eased);
    top = lerp(def.scatter.top, def.staging.top, eased);
    const sr = heroStepRotation(t);
    rot = sr.rotation;
    scale = sr.scale;
  } else if (e < def.landEnd) {
    const t = (e - def.rotateEnd) / (def.landEnd - def.rotateEnd);
    const eased = easeOutBack(t);
    left = lerp(def.staging.left, def.slot.left, eased);
    top = lerp(def.staging.top, def.slot.top, eased);
    rot = 0;
    scale = t > 0.8 ? 1 + (1 - (t - 0.8) / 0.2) * 0.08 : 1;
  } else {
    left = def.slot.left;
    top = def.slot.top;
    rot = 0;
    scale = 1;
  }
  return { ...base, visible: true, left, top, rot, scale };
}

export function heroSlotVisibleAt(def: HeroPieceDef, e: number): boolean {
  if (e >= HERO_GATHER_START) {
    // slot frame fades as its piece gathers away
    return e < HERO_GATHER_START + 500;
  }
  return e < def.landEnd;
}
