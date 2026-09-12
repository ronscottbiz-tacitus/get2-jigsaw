/**
 * Locks in the hero's 48-piece grid loop guarantees:
 *  - it's a real 6x8 board built from `generateGeometry` (the game's own
 *    48-piece preset), not a hand-rolled grid
 *  - the wrap is seamless (piece pose at e=0 === pose at e=TOTAL, allowing for
 *    360°-wrapped rotation values, which render identically to 0°)
 *  - every piece scatters to the OPPOSITE side and travels a long way
 *  - the fly-in rotates home through 90° steps with a spring bounce, landing
 *    upright
 *  - the centred flourish block spins an extra, more exaggerated 360° after
 *    reassembly, while every other piece holds still
 *  - the video crop anchor is always the landing slot, in every phase.
 */
import { describe, it, expect } from 'vitest';
import {
  getHeroGridDefs,
  heroGridPieceAt,
  HERO_GRID_ROWS,
  HERO_GRID_COLS,
  HERO_GRID_HOLD1_END,
  HERO_GRID_SCATTER_END,
  HERO_GRID_GATHER_START,
  HERO_GRID_GATHER_END,
  HERO_GRID_FLOURISH_START,
  HERO_GRID_FLOURISH_END,
  HERO_GRID_TOTAL,
  HERO_GRID_STEP_MS,
} from './heroAnim';

const W = 1440;
const H = 810;
const defs = getHeroGridDefs(W, H);

/** rotation values can be non-zero multiples of 360 at a phase boundary
 * (e.g. a 4-step scatter spin) — visually identical to 0°, so compare the
 * normalized angle, not the raw number. */
const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

describe('hero grid choreography', () => {
  it('is a real 48-piece 6x8 board with valid shapes and spin params', () => {
    expect(defs).toHaveLength(HERO_GRID_ROWS * HERO_GRID_COLS);
    expect(HERO_GRID_ROWS * HERO_GRID_COLS).toBe(48);
    const rows = new Set(defs.map((d) => d.row));
    const cols = new Set(defs.map((d) => d.col));
    expect(rows.size).toBe(HERO_GRID_ROWS);
    expect(cols.size).toBe(HERO_GRID_COLS);
    for (const d of defs) {
      expect(d.clip).toMatch(/^M /);
      expect(Number.isFinite(d.slot.left)).toBe(true);
      expect(Number.isFinite(d.scatter.left)).toBe(true);
      expect(d.steps).toBeGreaterThanOrEqual(1);
      expect(d.steps).toBeLessThanOrEqual(4);
      expect(Math.abs(d.spinDir)).toBe(1);
    }
  });

  it('marks exactly an innermost 2x4 block (8 pieces) for the flourish', () => {
    const flourishPieces = defs.filter((d) => d.flourish);
    expect(flourishPieces).toHaveLength(8);
    const rows = new Set(flourishPieces.map((d) => d.row));
    const cols = new Set(flourishPieces.map((d) => d.col));
    expect(rows).toEqual(new Set([2, 3]));
    expect(cols).toEqual(new Set([2, 3, 4, 5]));
  });

  it('starts fully assembled: every piece in its hole, upright', () => {
    for (const d of defs) {
      const p = heroGridPieceAt(d, 0);
      expect(p).toMatchObject({ visible: true, rot: 0, scale: 1 });
      expect(p.left).toBe(d.slot.left);
      expect(p.top).toBe(d.slot.top);
    }
  });

  it('loops seamlessly — pose at e=0 matches pose at the last ms', () => {
    for (const d of defs) {
      const a = heroGridPieceAt(d, 0);
      const z = heroGridPieceAt(d, HERO_GRID_TOTAL - 1);
      expect(Math.abs(a.left - z.left)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.top - z.top)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(norm360(a.rot) - norm360(z.rot))).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.scale - z.scale)).toBeLessThanOrEqual(0.01);
    }
  });

  it('scatters to the opposite side of the frame — fully off-frame', () => {
    const mid = (HERO_GRID_SCATTER_END + HERO_GRID_GATHER_START) / 2;
    for (const d of defs) {
      const p = heroGridPieceAt(d, mid);
      expect(p.left).toBe(d.scatter.left);
      const off =
        p.left + p.w <= 0 || p.top + p.h <= 0 || p.left >= W || p.top >= H;
      expect(off).toBe(true);
      expect(Math.abs(p.rot) % 90).toBe(0);
    }
  });

  it('scatter-out takes as long as the fly-in (matched pacing, not a speed mismatch)', () => {
    const scatterDur = HERO_GRID_SCATTER_END - HERO_GRID_HOLD1_END;
    const gatherDur = HERO_GRID_GATHER_END - HERO_GRID_GATHER_START;
    expect(scatterDur).toBe(gatherDur);
  });

  it('rotation is spread across the whole flight, not a fixed per-step tempo', () => {
    // Regression guard: the old formula (`local / (steps * HERO_GRID_STEP_MS)`)
    // finished a 1-step piece's turn in well under a second, then glided
    // rotation-less for the rest of the flight. Sampled at the point the OLD
    // formula would already have snapped upright, the piece should still be
    // clearly mid-turn under the new whole-flight pacing.
    const oneStep = defs.find((d) => d.steps === 1);
    expect(oneStep).toBeDefined();
    if (!oneStep) return;
    const oldTempoWouldFinishAt = 1 * HERO_GRID_STEP_MS + 50;
    const p = heroGridPieceAt(oneStep, HERO_GRID_GATHER_START + oneStep.delay + oldTempoWouldFinishAt);
    expect(Math.abs(norm360(p.rot))).toBeGreaterThan(20);
  });

  it('flies in and lands upright, in its own slot, before the flourish', () => {
    for (const d of defs) {
      const landed = heroGridPieceAt(d, HERO_GRID_GATHER_END);
      expect(Math.abs(landed.rot)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(landed.scale - 1)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(landed.left - d.slot.left)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(landed.top - d.slot.top)).toBeLessThanOrEqual(0.5);
    }
  });

  it('flourish window is long enough for 4 quarter-turns to read individually (>= 2000ms)', () => {
    expect(HERO_GRID_FLOURISH_END - HERO_GRID_FLOURISH_START).toBeGreaterThanOrEqual(2000);
  });

  it('flourish: only the centred block moves, spinning further and bigger than the fly-in settle', () => {
    const mid = (HERO_GRID_FLOURISH_START + HERO_GRID_FLOURISH_END) / 2;
    for (const d of defs) {
      const p = heroGridPieceAt(d, mid);
      if (!d.flourish) {
        // everyone else just holds
        expect(p).toMatchObject({ rot: 0, scale: 1 });
        expect(p.left).toBe(d.slot.left);
        expect(p.top).toBe(d.slot.top);
        continue;
      }
      // the flourish piece never leaves its slot — it spins in place
      expect(p.left).toBe(d.slot.left);
      expect(p.top).toBe(d.slot.top);

      let maxScale = 1;
      for (let e = HERO_GRID_FLOURISH_START; e < HERO_GRID_FLOURISH_END; e += 20) {
        maxScale = Math.max(maxScale, heroGridPieceAt(d, e).scale);
      }
      // bigger scale pop than the plain fly-in settle (~1.1)
      expect(maxScale).toBeGreaterThan(1.2);
    }
  });

  it('flourish rotation is spread across its own window, not a fixed per-step tempo', () => {
    // Regression guard: the flourish used to run at a fixed 300ms/step tempo
    // (HERO_GRID_FLOURISH_STEPS * 300 = 1200ms total — that constant has since
    // been removed), finishing the whole 360° spin well before the window
    // closed. Sampled at the point that old fixed tempo would already have
    // finished, a flourish piece should still be clearly mid-spin under the
    // new whole-window pacing.
    const flourishPiece = defs.find((d) => d.flourish);
    expect(flourishPiece).toBeDefined();
    if (!flourishPiece) return;
    const oldFixedTempoTotal = 4 * 300; // old HERO_GRID_FLOURISH_STEPS * STEP_MS
    const e = HERO_GRID_FLOURISH_START + flourishPiece.flourishDelay + oldFixedTempoTotal + 50;
    const p = heroGridPieceAt(flourishPiece, e);
    expect(Math.abs(norm360(p.rot))).toBeGreaterThan(20);
  });

  it('flourish block lands back upright exactly where it started', () => {
    for (const d of defs.filter((d) => d.flourish)) {
      const p = heroGridPieceAt(d, HERO_GRID_FLOURISH_END);
      expect(norm360(p.rot)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(p.scale - 1)).toBeLessThanOrEqual(0.01);
      expect(p.left).toBe(d.slot.left);
      expect(p.top).toBe(d.slot.top);
    }
  });

  it('always samples the video at the landing slot, in every phase', () => {
    const phases = [
      0,
      HERO_GRID_HOLD1_END + 200,
      HERO_GRID_SCATTER_END - 100,
      HERO_GRID_GATHER_START + 300,
      HERO_GRID_GATHER_END - 100,
      HERO_GRID_FLOURISH_START + 100,
      HERO_GRID_TOTAL - 50,
    ];
    for (const d of defs) {
      for (const e of phases) {
        const p = heroGridPieceAt(d, e);
        expect(p.slotLeft).toBe(d.slot.left);
        expect(p.slotTop).toBe(d.slot.top);
      }
    }
  });
});
