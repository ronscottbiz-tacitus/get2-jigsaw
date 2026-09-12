/**
 * Pure maths for the hero's continuous loop: a full 48-piece ("6 rows × 8 cols",
 * the real game's default preset — see `PIECE_COUNT_PRESETS` in
 * `game/constants.ts`) live-video grid ("murmuration").
 *
 * Piece shapes come from `generateGeometry(6, 8, 'moderate')` — the exact
 * function the real playable game uses to build that preset — so the tab/notch
 * edges are authentic jigsaw geometry, not an approximation. Only the piece's
 * *placement* is remapped: `generateGeometry` lays pieces out on the engine's
 * fixed 840x480 board, and here that board is stretched to fill whatever size
 * the hero section actually renders at (full-bleed, edge to edge).
 *
 * The loop is:
 *
 *   assembled hold
 *   → scatter outward to the OPPOSITE side of the frame (staggered, easeInOutCubic)
 *   → scattered hold
 *   → fly back in across the whole frame, rotating home through 90° steps with a
 *     spring bounce (`steppedAngle`, same curve family as the hero's old fly-in)
 *   → resolved hold
 *   → flourish: a centred block of pieces (the innermost 2 rows × 4 cols of the
 *     6×8 grid) spins through a full extra 360° (4 quarter-turns) with a more
 *     exaggerated overshoot/bounce than the settle-in above, while every other
 *     piece just holds — landing back upright exactly where it started
 *   → final hold
 *   → (loop)
 *
 * A piece is at its slot, rotation a clean multiple of 360°, scale 1 at BOTH the
 * end of the final hold and the start of the next assembled hold, so the wrap is
 * seamless (raw rotation values can be non-zero multiples of 360 at some
 * boundaries — e.g. a 4-step scatter spin, or the flourish's own 360° sweep —
 * which is visually identical to 0° once rendered; the existing scatter-spin
 * code already relies on this).
 *
 * The video crop each piece carries is always sampled at `slot` (its landing
 * position), never its current position, so a landed piece blends into the
 * backdrop — same technique as before.
 */
import { generateGeometry } from '../../game/geometry';
import { BOARD_W, BOARD_H, BOARD_OFFSET_X, BOARD_OFFSET_Y } from '../../game/constants';

// ---- easing ------------------------------------------------------------
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** Gentle S-curve — the closest-to-linear ease. Soft start/stop, even speed in
 * between, so travel time reads as ≈ the duration (used for the long fly-in). */
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
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

/** deterministic per-index PRNG so scatter targets never change between frames.
 * Exported so both the hero grid (below) and the moved "Rotation changes
 * everything." piece set (`rotationDemoAnim.ts`) share one implementation. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fly-in origin for a piece whose home centre is (`scx`,`scy`): head AWAY from
 * the frame centre (`cx`,`cy`), toward the opposite side, landing just past the
 * frame edge in that direction (+ the piece size + a little variance) — fully
 * off-frame, but no further, so the fly-in is almost entirely *visible* on-screen
 * travel rather than a long off-frame void crossing. Shared by the hero grid and
 * the moved "Rotation changes everything." piece set.
 */
export function scatterTarget(
  scx: number,
  scy: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  spread: number,
  r: () => number,
): { left: number; top: number } {
  let ux = cx - scx;
  let uy = cy - scy;
  const d2c = Math.hypot(ux, uy) || 1;
  ux /= d2c;
  uy /= d2c;
  const edgeDist = Math.min(
    Math.abs(ux) > 1e-4 ? cx / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-4 ? cy / Math.abs(uy) : Infinity,
  );
  const outDist = edgeDist + Math.max(w, h) + spread * (0.05 + r() * 0.12);
  const jitter = (r() - 0.5) * spread * 0.24; // perpendicular variety
  return {
    left: Math.round(cx + ux * outDist + -uy * jitter - w / 2),
    top: Math.round(cy + uy * outDist + ux * jitter - h / 2),
  };
}

// ---- hero grid: timeline (ms) ------------------------------------------
export const HERO_GRID_ROWS = 6;
export const HERO_GRID_COLS = 8;

export const HERO_GRID_HOLD1_END = 900; // assembled hold
// Scatter-out now takes as long as the fly-in (5000ms) — with 48 pieces
// launching at once instead of the old hero's 11, a faster scatter read as a
// jarring speed mismatch against the (confirmed correct) fly-in pace.
export const HERO_GRID_SCATTER_END = 5900; // pieces have reached the far side
export const HERO_GRID_GATHER_START = 6400; // begin flying home (brief scattered beat)
export const HERO_GRID_GATHER_END = 11400; // pieces are back in their holes, upright
export const HERO_GRID_FLOURISH_START = 11700; // brief settle hold, then the centre block spins
// 2200ms for the 4-quarter-turn flourish (~550ms/step) — like the fly-in fix,
// a fixed 300ms/step tempo (1200ms total) was too fast to read as 4 distinct
// beats, especially with FLOURISH_SNAP's bigger overshoot needing more time
// to land clearly.
export const HERO_GRID_FLOURISH_END = 13900;
export const HERO_GRID_TOTAL = 14600; // + a final hold, then the loop wraps

/** No longer used to pace the fly-in rotation (see `heroGridPieceAt` — each
 * piece's rotation is now spread across its own `posDur`, the same window its
 * position eases over, not a fixed per-step tempo). Kept because Hero.tsx's
 * dev debug hook still surfaces it. */
export const HERO_GRID_STEP_MS = 620;

/** Snap options for the fly-in. Since each piece's full rotation is now
 * spread across its whole flight (a 1-step piece turns once, slowly, across
 * nearly the entire window; a 4-step piece gets four beats spread the same
 * way), quarter-turns no longer need a fast, punchy overshoot to read — a
 * bigger `turnPortion` (most of each step's slice is spent actually turning,
 * not settling) and a smaller overshoot/scale pop keep each turn a clear,
 * deliberate motion instead of a slow-motion wobble. */
export const HERO_GRID_SNAP: SteppedOpts = {
  turnPortion: 0.72,
  overshoot: 0.08,
  scalePulse: 0.1,
  hold: 0.15,
};

/** Quarter-turns the centre-block flourish spins through — a full extra
 * rotation, so it lands back upright exactly where it started. */
export const HERO_GRID_FLOURISH_STEPS = 4;

/** More exaggerated than `HERO_GRID_SNAP`: bigger overshoot, longer hold at the
 * peak, and a bigger scale pop — the flourish should read as distinctly
 * punchier than the settle-in rotation the rest of the piece set just did. */
export const HERO_GRID_FLOURISH_SNAP: SteppedOpts = {
  turnPortion: 0.34,
  overshoot: 0.38,
  scalePulse: 0.42,
  hold: 0.46,
};

/**
 * `generateGeometry`'s path coordinates are local to the piece's own
 * `boxW x boxH` box (in the engine's native 840x480 board units). Since the
 * hero stretches that board non-uniformly to fill whatever size it actually
 * renders at, each piece's clip path has to be rescaled by the same (sx, sy)
 * factors as its box — otherwise the path would still describe the small
 * native-unit shape while the piece is drawn into a much larger/smaller box.
 * Every coordinate in `buildEdge`'s output is a plain (x, y) pair in sequence
 * (no flags or other params), so scaling every other number is exact — and
 * because independent x/y scaling is an affine map, the rescaled Béziers are
 * still exact Béziers, not an approximation.
 */
function scalePath(d: string, sx: number, sy: number): string {
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (n) => {
    const scaled = (i++ % 2 === 0 ? Number(n) * sx : Number(n) * sy);
    return String(Math.round(scaled * 100) / 100);
  });
}

let _gridGeo: ReturnType<typeof generateGeometry> | null = null;
/** The 48-piece board geometry, generated once (it uses `Math.random` inside)
 * and reused for the life of the page. */
function gridGeometry() {
  if (!_gridGeo) _gridGeo = generateGeometry(HERO_GRID_ROWS, HERO_GRID_COLS, 'moderate');
  return _gridGeo;
}

export interface HeroGridPieceDef {
  row: number;
  col: number;
  slot: { left: number; top: number };
  /** fly-in origin — the far side of the frame, opposite this piece's slot. */
  scatter: { left: number; top: number };
  /** quarter-turns (1–4) the piece rotates through on the fly-in home. */
  steps: number;
  /** +1 / −1 — which way it spins. */
  spinDir: number;
  /** stagger (ms) applied to both the scatter-out and the fly-in legs. */
  delay: number;
  /** true for the centred 2-row × 4-col block that performs the end-of-loop
   * flourish (the innermost rows/cols of the 6×8 grid). */
  flourish: boolean;
  /** extra per-piece stagger (ms), flourish pieces only — a small ripple across
   * the block rather than every piece snapping in lockstep. */
  flourishDelay: number;
  w: number;
  h: number;
  clip: string;
}

/** Rows 2–3 of 6 and cols 2–5 of 8 — the innermost 2×4 block, centred both ways
 * in the grid. A judgment call: any centred block reads fine here since the
 * headline/CTA overlay (not this block specifically) is what needs to stay
 * legible, and the exact geometric centre of an even 6×8 grid. */
const FLOURISH_ROWS = new Set([2, 3]);
const FLOURISH_COLS = new Set([2, 3, 4, 5]);

export function getHeroGridDefs(heroW: number, heroH: number): HeroGridPieceDef[] {
  const geo = gridGeometry();
  const sx = heroW / BOARD_W;
  const sy = heroH / BOARD_H;
  const cx = heroW / 2;
  const cy = heroH / 2;
  const spread = Math.max(heroW, heroH);

  return geo.pieces.map((piece, i) => {
    const [rStr, cStr] = piece.id.split('-');
    const row = Number(rStr);
    const col = Number(cStr);
    const left = Math.round((piece.homeLeft - BOARD_OFFSET_X) * sx);
    const top = Math.round((piece.homeTop - BOARD_OFFSET_Y) * sy);
    const w = piece.boxW * sx;
    const h = piece.boxH * sy;
    const scx = left + w / 2;
    const scy = top + h / 2;

    const r = mulberry32(0x2545f491 ^ (i * 2246822519));
    const scatter = scatterTarget(scx, scy, cx, cy, w, h, spread, r);
    const steps = 1 + Math.floor(r() * 4); // 1..4 quarter-turns
    const spinDir = r() < 0.5 ? 1 : -1;

    const d2c = Math.hypot(scx - cx, scy - cy);
    const radiusNorm = clamp01(d2c / (spread * 0.62));
    const delay = Math.round((1 - radiusNorm) * 260 + r() * 140);

    const flourish = FLOURISH_ROWS.has(row) && FLOURISH_COLS.has(col);
    const flourishDelay = flourish ? Math.round(Math.abs(col - 3.5) * 40) : 0;

    return {
      row,
      col,
      slot: { left, top },
      scatter,
      steps,
      spinDir,
      delay,
      flourish,
      flourishDelay,
      w,
      h,
      clip: scalePath(piece.pathD, sx, sy),
    };
  });
}

export interface HeroGridPieceState {
  visible: boolean;
  left: number;
  top: number;
  rot: number;
  scale: number;
  w: number;
  h: number;
  clip: string;
  /** The video region this piece reveals is always sampled at its landing slot
   * — never its current position — so the sliver it carries matches exactly
   * where it comes to rest. */
  slotLeft: number;
  slotTop: number;
}

export function heroGridPieceAt(def: HeroGridPieceDef, e: number): HeroGridPieceState {
  const base = {
    visible: true,
    w: def.w,
    h: def.h,
    clip: def.clip,
    slotLeft: def.slot.left,
    slotTop: def.slot.top,
  };
  const atSlot: HeroGridPieceState = {
    ...base,
    left: def.slot.left,
    top: def.slot.top,
    rot: 0,
    scale: 1,
  };
  const spunAngle = def.spinDir * def.steps * 90; // orientation while scattered

  // A — assembled hold
  if (e < HERO_GRID_HOLD1_END) return atSlot;

  // B — scatter outward to the far side
  if (e < HERO_GRID_SCATTER_END) {
    const dur = Math.max(1, HERO_GRID_SCATTER_END - HERO_GRID_HOLD1_END - def.delay);
    const t = clamp01((e - HERO_GRID_HOLD1_END - def.delay) / dur);
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
  if (e < HERO_GRID_GATHER_START) {
    return {
      ...base,
      left: def.scatter.left,
      top: def.scatter.top,
      rot: spunAngle,
      scale: 1,
    };
  }

  // D — fly home across the frame
  if (e < HERO_GRID_GATHER_END) {
    const local = e - HERO_GRID_GATHER_START - def.delay;
    const posDur = Math.max(1, HERO_GRID_GATHER_END - HERO_GRID_GATHER_START - def.delay);
    const kPos = easeInOutSine(clamp01(local / posDur));
    // Rotation is spread across the SAME window position eases over (posDur),
    // not a fixed per-step tempo — otherwise a 1-step piece finishes turning
    // in well under a second and glides rotation-less for the rest of the
    // flight while a 4-step piece is still turning much later, and 48 pieces
    // all landing their turns at different times reads as jittery.
    const tRot = clamp01(local / posDur);
    const sr = steppedAngle(tRot, def.steps * 90, def.steps, HERO_GRID_SNAP);
    return {
      ...base,
      left: lerp(def.scatter.left, def.slot.left, kPos),
      top: lerp(def.scatter.top, def.slot.top, kPos),
      rot: def.spinDir * sr.rotation,
      scale: sr.scale,
    };
  }

  // E — brief settle hold before the flourish
  if (e < HERO_GRID_FLOURISH_START) return atSlot;

  // F — flourish: only the centred block moves, spinning a full extra 360°
  // (4 quarter-turns) with a bigger overshoot/bounce than the fly-in settle —
  // everyone else just holds.
  if (e < HERO_GRID_FLOURISH_END) {
    if (!def.flourish) return atSlot;
    const local = e - HERO_GRID_FLOURISH_START - def.flourishDelay;
    // Spread across the flourish's own window, same pattern as the fly-in fix
    // — not a fixed per-step tempo, so all 4 quarter-turns are individually
    // visible instead of firing off in a blur.
    const dur = Math.max(1, HERO_GRID_FLOURISH_END - HERO_GRID_FLOURISH_START - def.flourishDelay);
    const t = clamp01(local / dur);
    const sr = steppedAngle(t, 360, HERO_GRID_FLOURISH_STEPS, HERO_GRID_FLOURISH_SNAP);
    return {
      ...base,
      left: def.slot.left,
      top: def.slot.top,
      rot: def.spinDir * sr.rotation,
      scale: sr.scale,
    };
  }

  // G — final hold, until the loop wraps back to A (same pose → no jump)
  return atSlot;
}

/** The breathing hole outline shows while its piece is away from home (scatter
 * / fly-in only — during the flourish the piece is physically at rest in its
 * slot, just spinning in place, so no hole is exposed). */
export function heroGridSlotVisibleAt(def: HeroGridPieceDef, e: number): boolean {
  const gone = HERO_GRID_HOLD1_END + def.delay + 100;
  const back = HERO_GRID_GATHER_END - 350;
  return e > gone && e < back;
}
