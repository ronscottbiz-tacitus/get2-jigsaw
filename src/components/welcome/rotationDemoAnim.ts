/**
 * Pure maths for the "Rotation changes everything." demo: a contiguous 2x2 block
 * lifted out of a real 5x5 Mountain Valley grid. Left column demonstrates
 * Moderate (stepped 90° with bounce), right column demonstrates Hard (smooth
 * free-rotation). Both resolve to upright and interlock into one solved quad,
 * then everything gathers back home before the loop repeats.
 *
 * Ported from the prototype's `getMtnDemoDefs`, `rotDemoSteppedAngle`, and the
 * `mtnDemo` block of `renderVals`. The block shares one hEdge/vEdge table (same
 * rule as the real engine) so the four focal pieces genuinely interlock.
 */
import { buildEdge, randEdgeParams } from '../../game/geometry';
import { BLEED } from '../../game/constants';
import { easeOutCubic, lerp } from './heroAnim';

export const MTN_HOLD_END = 1000;
export const MTN_STAGE_END = 2600;
export const MTN_MOD_ROTATE_END = 4000;
export const MTN_HARD_ROTATE_END = 4200;
export const MTN_RESOLVED_HOLD_END = 5600;
export const MTN_GATHER_END = 7200;
export const MTN_TOTAL = 7700;

/** Stepped 90° rotation with a spring bounce at the end of each step. */
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

interface FocalDef {
  id: string;
  focal: true;
  mode: 'mod' | 'hard';
  home: { left: number; top: number };
  staged: { left: number; top: number };
  wrongAngle: number;
  w: number;
  h: number;
  clip: string;
}
interface LooseDef {
  id: string;
  focal: false;
  home: { left: number; top: number };
  scatter: { left: number; top: number; rot: number };
  delay: number;
  w: number;
  h: number;
  clip: string;
}
export type MtnDef = FocalDef | LooseDef;
export interface MtnDefs {
  boxW: number;
  boxH: number;
  pieces: MtnDef[];
}

let _defs: MtnDefs | null = null;

export function getMtnDefs(): MtnDefs {
  if (_defs) return _defs;
  const rows = 5;
  const cols = 5;
  const boxW = 600;
  const boxH = 450;
  const cellW = boxW / cols;
  const cellH = boxH / rows;
  const pad = Math.min(cellW, cellH) * 0.4;
  const pieceW = cellW + 2 * pad;
  const pieceH = cellH + 2 * pad;
  const baseRow = 1;
  const baseCol = 1;
  const ENLARGE = 1.9;
  const stagedCenterX = boxW * 0.5;
  const stagedCenterY = boxH * 0.5;
  const wrongAngleGrid: Record<string, number> = {
    '0-0': 270,
    '1-0': 180,
    '0-1': -150,
    '1-1': 200,
  };
  const focalMap: Record<
    string,
    { mode: 'mod' | 'hard'; wrongAngle: number; staged: { left: number; top: number } }
  > = {};
  ([
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const).forEach(([lr, lc]) => {
    const r = baseRow + lr;
    const c = baseCol + lc;
    const centerOffsetX = (lc - 0.5) * cellW * ENLARGE;
    const centerOffsetY = (lr - 0.5) * cellH * ENLARGE;
    focalMap[`${r}-${c}`] = {
      mode: lc === 0 ? 'mod' : 'hard',
      wrongAngle: wrongAngleGrid[`${lr}-${lc}`],
      staged: {
        left: stagedCenterX + centerOffsetX - pieceW / 2,
        top: stagedCenterY + centerOffsetY - pieceH / 2,
      },
    };
  });

  const hEdge = [];
  for (let r = 0; r < rows - 1; r++) {
    hEdge.push([] as ReturnType<typeof randEdgeParams>[]);
    for (let c = 0; c < cols; c++) hEdge[r].push(randEdgeParams());
  }
  const vEdge = [];
  for (let r = 0; r < rows; r++) {
    vEdge.push([] as ReturnType<typeof randEdgeParams>[]);
    for (let c = 0; c < cols - 1; c++) vEdge[r].push(randEdgeParams());
  }

  const defs: MtnDef[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}-${c}`;
      const focal = focalMap[key];
      const home = { left: c * cellW - pad, top: r * cellH - pad };
      const TL = { x: pad, y: pad };
      const TR = { x: pad + cellW, y: pad };
      const BR = { x: pad + cellW, y: pad + cellH };
      const BL = { x: pad, y: pad + cellH };
      const topEdge = r > 0 ? hEdge[r - 1][c] : null;
      const rightEdge = c < cols - 1 ? vEdge[r][c] : null;
      const bottomEdge = r < rows - 1 ? hEdge[r][c] : null;
      const leftEdge = c > 0 ? vEdge[r][c - 1] : null;
      const topOutward = topEdge ? topEdge.dir === -1 : false;
      const rightOutward = rightEdge ? rightEdge.dir === 1 : false;
      const bottomOutward = bottomEdge ? bottomEdge.dir === 1 : false;
      const leftOutward = leftEdge ? leftEdge.dir === -1 : false;
      const d =
        buildEdge(TL, TR, r === 0, topOutward, topEdge || {}) +
        buildEdge(TR, BR, c === cols - 1, rightOutward, rightEdge || {}) +
        buildEdge(BR, BL, r === rows - 1, bottomOutward, bottomEdge || {}) +
        buildEdge(BL, TL, c === 0, leftOutward, leftEdge || {});
      const clip = `M ${TL.x} ${TL.y} ${d} Z`;
      if (focal) {
        defs.push({
          id: key,
          focal: true,
          mode: focal.mode,
          home,
          staged: focal.staged,
          wrongAngle: focal.wrongAngle,
          w: pieceW,
          h: pieceH,
          clip,
        });
      } else {
        const cx = (c + 0.5) / cols - 0.5;
        const cy = (r + 0.5) / rows - 0.5;
        const mag = 1.5 + Math.random() * 0.5;
        defs.push({
          id: key,
          focal: false,
          home,
          scatter: {
            left: boxW / 2 + cx * boxW * mag - pieceW / 2,
            top: boxH / 2 + cy * boxH * mag - pieceH / 2,
            rot: (Math.random() - 0.5) * 260,
          },
          delay: (Math.abs(r - 2) + Math.abs(c - 2)) * 65,
          w: pieceW,
          h: pieceH,
          clip,
        });
      }
    }
  }

  _defs = { boxW, boxH, pieces: defs };
  return _defs;
}

export interface MtnPieceState {
  left: number;
  top: number;
  rot: number;
  scale: number;
  w: number;
  h: number;
  clip: string;
  shadow: string;
  glow: number;
  bgX: number;
  bgY: number;
  z: number;
}

export function mtnPieceAt(def: MtnDef, e: number): MtnPieceState {
  const bgX = -def.home.left;
  const bgY = -def.home.top;
  const z = def.focal ? 500 : 1;
  const base = { w: def.w, h: def.h, clip: def.clip, bgX, bgY, z };
  const holdEnd = MTN_HOLD_END;
  const stageEnd = MTN_STAGE_END;
  const modEnd = MTN_MOD_ROTATE_END;
  const hardEnd = MTN_HARD_ROTATE_END;
  const resolvedHoldEnd = MTN_RESOLVED_HOLD_END;
  const gatherEnd = MTN_GATHER_END;

  if (e < holdEnd)
    return { ...base, left: def.home.left, top: def.home.top, rot: 0, scale: BLEED, shadow: 'none', glow: 0 };
  if (e >= gatherEnd)
    return { ...base, left: def.home.left, top: def.home.top, rot: 0, scale: BLEED, shadow: 'none', glow: 0 };

  if (!def.focal) {
    if (e < stageEnd) {
      const t = Math.min(
        1,
        Math.max(0, (e - holdEnd - def.delay) / (stageEnd - holdEnd - def.delay)),
      );
      const eased = easeOutCubic(t);
      return {
        ...base,
        left: lerp(def.home.left, def.scatter.left, eased),
        top: lerp(def.home.top, def.scatter.top, eased),
        rot: lerp(0, def.scatter.rot, eased),
        scale: lerp(BLEED, 1, eased),
        shadow: t > 0.02 ? '0 8px 18px rgba(0,0,0,.5)' : 'none',
        glow: 0,
      };
    }
    if (e < resolvedHoldEnd)
      return {
        ...base,
        left: def.scatter.left,
        top: def.scatter.top,
        rot: def.scatter.rot,
        scale: 1,
        shadow: '0 8px 18px rgba(0,0,0,.5)',
        glow: 0,
      };
    const gt = Math.min(
      1,
      Math.max(0, (e - resolvedHoldEnd - def.delay) / (gatherEnd - resolvedHoldEnd - def.delay)),
    );
    const eased = easeOutCubic(gt);
    return {
      ...base,
      left: lerp(def.scatter.left, def.home.left, eased),
      top: lerp(def.scatter.top, def.home.top, eased),
      rot: lerp(def.scatter.rot, 0, eased),
      scale: lerp(1, BLEED, eased),
      shadow: gt < 0.98 ? '0 8px 18px rgba(0,0,0,.5)' : 'none',
      glow: 0,
    };
  }

  // focal piece
  const rotateEnd = def.mode === 'mod' ? modEnd : hardEnd;
  if (e < stageEnd) {
    const t = easeOutCubic(Math.min(1, (e - holdEnd) / (stageEnd - holdEnd)));
    return {
      ...base,
      left: lerp(def.home.left, def.staged.left, t),
      top: lerp(def.home.top, def.staged.top, t),
      rot: lerp(0, def.wrongAngle, t),
      scale: lerp(BLEED, 1.9, t),
      shadow: '0 12px 26px rgba(0,0,0,.55)',
      glow: 0,
    };
  }
  if (e < rotateEnd) {
    const t = (e - stageEnd) / (rotateEnd - stageEnd);
    let rot: number;
    let scale: number;
    if (def.mode === 'mod') {
      const sr = steppedAngle(
        t,
        def.wrongAngle,
        Math.round(Math.abs(def.wrongAngle) / 90) || 3,
      );
      rot = sr.rotation;
      scale = 1.9 + (sr.scale - 1) * 0.8;
    } else {
      rot = lerp(def.wrongAngle, 0, easeOutCubic(t));
      scale = 1.9;
    }
    return {
      ...base,
      left: def.staged.left,
      top: def.staged.top,
      rot,
      scale,
      shadow: '0 12px 26px rgba(0,0,0,.55)',
      glow: 0,
    };
  }
  if (e < resolvedHoldEnd) {
    const settleT = Math.min(1, (e - rotateEnd) / 260);
    const scale = 1.9 + (1 - settleT) * 0.15;
    const glow = Math.max(0, 1 - (e - rotateEnd) / 500);
    return {
      ...base,
      left: def.staged.left,
      top: def.staged.top,
      rot: 0,
      scale,
      shadow: '0 14px 30px rgba(0,0,0,.6)',
      glow,
    };
  }
  const gt = easeOutCubic(
    Math.min(1, Math.max(0, (e - resolvedHoldEnd) / (gatherEnd - resolvedHoldEnd))),
  );
  return {
    ...base,
    left: lerp(def.staged.left, def.home.left, gt),
    top: lerp(def.staged.top, def.home.top, gt),
    rot: 0,
    scale: lerp(1.9, BLEED, gt),
    shadow: gt < 0.98 ? '0 12px 26px rgba(0,0,0,.55)' : 'none',
    glow: 0,
  };
}

export function mtnShowCopyAt(e: number): boolean {
  return e >= MTN_HARD_ROTATE_END + 150 && e < MTN_RESOLVED_HOLD_END + 400;
}
