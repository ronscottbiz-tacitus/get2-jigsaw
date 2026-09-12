/**
 * Locks in the "Rotation changes everything." loop's guarantees (this used to
 * be the marketing hero's own loop — the choreography is unchanged, only its
 * home and names moved when the hero swapped to the 48-piece murmuration grid):
 *  - the wrap is seamless (piece pose at e=0 === pose at e=TOTAL)
 *  - every piece scatters to the OPPOSITE side and travels a long way
 *  - the fly-in rotates home through 90° steps with a spring bounce, landing
 *    upright
 *  - the video crop anchor is always the landing slot, in every phase.
 */
import { describe, it, expect } from 'vitest';
import {
  getRotationPieceDefs,
  rotationPieceAt,
  ROTATION_HOLD1_END,
  ROTATION_SCATTER_END,
  ROTATION_GATHER_START,
  ROTATION_GATHER_END,
  ROTATION_TOTAL,
  ROTATION_STEP_MS,
} from './rotationDemoAnim';

const W = 1440;
const H = 810;
const defs = getRotationPieceDefs(W, H);

describe('rotation demo choreography', () => {
  it('has 11 real pieces with valid spin params', () => {
    expect(defs).toHaveLength(11);
    for (const d of defs) {
      expect(d.clip).toMatch(/^M /);
      expect(Number.isFinite(d.slot.left)).toBe(true);
      expect(Number.isFinite(d.scatter.left)).toBe(true);
      expect(d.steps).toBeGreaterThanOrEqual(1);
      expect(d.steps).toBeLessThanOrEqual(4);
      expect(Math.abs(d.spinDir)).toBe(1);
    }
  });

  it('starts fully assembled: every piece in its hole, upright', () => {
    for (const d of defs) {
      const p = rotationPieceAt(d, 0);
      expect(p).toMatchObject({ visible: true, rot: 0, scale: 1 });
      expect(p.left).toBe(d.slot.left);
      expect(p.top).toBe(d.slot.top);
    }
  });

  it('loops seamlessly — pose at e=0 matches pose at the last ms', () => {
    for (const d of defs) {
      const a = rotationPieceAt(d, 0);
      const z = rotationPieceAt(d, ROTATION_TOTAL - 1);
      expect(Math.abs(a.left - z.left)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.top - z.top)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.rot - z.rot)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.scale - z.scale)).toBeLessThanOrEqual(0.01);
    }
  });

  it('scatters to the opposite side of the frame — long travel, fully off-frame', () => {
    const mid = (ROTATION_SCATTER_END + ROTATION_GATHER_START) / 2;
    const cx = W / 2;
    const cy = H / 2;
    for (const d of defs) {
      const p = rotationPieceAt(d, mid);
      expect(p.left).toBe(d.scatter.left);
      // opposite side: slot and scatter centres are on opposite sides of centre
      const slotSide = Math.sign(d.slot.left + d.w / 2 - cx);
      const scatSide = Math.sign(d.scatter.left + d.w / 2 - cx);
      const slotSideY = Math.sign(d.slot.top + d.h / 2 - cy);
      const scatSideY = Math.sign(d.scatter.top + d.h / 2 - cy);
      expect(slotSide !== scatSide || slotSideY !== scatSideY).toBe(true);
      // fully outside the frame
      const off =
        p.left + p.w <= 0 || p.top + p.h <= 0 || p.left >= W || p.top >= H;
      expect(off).toBe(true);
      // travelled at least a half-diagonal
      const dist = Math.hypot(p.left - d.slot.left, p.top - d.slot.top);
      expect(dist).toBeGreaterThan(Math.hypot(W, H) / 2);
      // held at its spun orientation (a clean multiple of 90)
      expect(Math.abs(p.rot) % 90).toBe(0);
    }
  });

  it('flies in with pronounced stepped 90° snaps — overshoot, hold, big scale pop, landing upright', () => {
    for (const d of defs) {
      const startRot = d.spinDir * d.steps * 90;
      const near = rotationPieceAt(d, ROTATION_GATHER_START + d.delay + 10);
      expect(Math.abs(near.rot - startRot)).toBeLessThan(90);

      let maxScale = 1;
      let minSpun = Infinity; // spinDir*rot; goes negative when it overshoots upright
      let maxAbsRot = 0;
      let holdFrames = 0; // consecutive samples near an overshoot peak
      let run = 0;
      for (let e = ROTATION_GATHER_START; e < ROTATION_GATHER_END; e += 30) {
        const p = rotationPieceAt(d, e);
        maxScale = Math.max(maxScale, p.scale);
        minSpun = Math.min(minSpun, d.spinDir * p.rot);
        maxAbsRot = Math.max(maxAbsRot, Math.abs(p.rot));
        if (p.scale > 1.12) {
          run++;
          holdFrames = Math.max(holdFrames, run);
        } else run = 0;
      }
      // bigger scale pop than the plain curve (~1.1)
      expect(maxScale).toBeGreaterThan(1.15);
      // rotational overshoot: the piece rotates past upright before settling
      expect(minSpun).toBeLessThan(-6);
      // the peak is held for a few frames (≥ ~60ms at 30ms sampling), not a flick
      expect(holdFrames).toBeGreaterThanOrEqual(2);
      expect(maxAbsRot).toBeGreaterThanOrEqual(Math.abs(startRot) - 1);

      const landed = rotationPieceAt(d, ROTATION_GATHER_END);
      expect(Math.abs(landed.rot)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(landed.scale - 1)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(landed.left - d.slot.left)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(landed.top - d.slot.top)).toBeLessThanOrEqual(0.5);
    }
  });

  it('every 90° step runs at the same wall-clock tempo regardless of step count', () => {
    // a 1-step and a 4-step piece should take the same time per quarter-turn
    const perStepMs = ROTATION_STEP_MS;
    for (const d of defs) {
      // the turn of the first step completes within ~turnPortion*perStepMs
      const start = ROTATION_GATHER_START + d.delay;
      const afterFirstTurn = rotationPieceAt(d, start + perStepMs * 0.42 + 5);
      const firstTarget = d.spinDir * (d.steps * 90 - 90);
      expect(Math.abs(afterFirstTurn.rot - firstTarget)).toBeLessThan(30);
      // all steps done by steps*perStepMs (+ a little) — upright well before it seats
      const doneRot = rotationPieceAt(d, start + d.steps * perStepMs + 40).rot;
      expect(Math.abs(doneRot)).toBeLessThanOrEqual(0.5);
    }
  });

  it('fly-in position eases straight home (no overshoot)', () => {
    for (const d of defs) {
      const samples: number[] = [];
      for (let e = ROTATION_GATHER_START; e <= ROTATION_GATHER_END; e += 120) {
        const p = rotationPieceAt(d, e);
        samples.push(Math.hypot(p.left - d.slot.left, p.top - d.slot.top));
      }
      let regressions = 0;
      for (let i = 1; i < samples.length; i++)
        if (samples[i] > samples[i - 1] + 2) regressions++;
      expect(regressions).toBe(0);
    }
  });

  it('fly-in travel is spread across the window, not front-loaded', () => {
    // regression guard: easeOutCubic here made a piece cover ~85% of its
    // journey in the first ~40% of the window (it "arrived" in ~1.5s of a 3s
    // window). With an even ease the travelled fraction should track elapsed.
    const win = ROTATION_GATHER_END - ROTATION_GATHER_START;
    for (const d of defs) {
      const start = ROTATION_GATHER_START + d.delay;
      const total = Math.hypot(
        d.scatter.left - d.slot.left,
        d.scatter.top - d.slot.top,
      );
      const travelledAt = (frac: number) => {
        const p = rotationPieceAt(d, start + win * frac);
        const dist = Math.hypot(p.left - d.slot.left, p.top - d.slot.top);
        return 1 - dist / total;
      };
      // at 25% of the window: nowhere near home
      expect(travelledAt(0.25)).toBeLessThan(0.35);
      // at the midpoint: roughly half way (even pacing)
      expect(travelledAt(0.5)).toBeGreaterThan(0.35);
      expect(travelledAt(0.5)).toBeLessThan(0.65);
      // still visibly moving at 75%
      expect(travelledAt(0.75)).toBeLessThan(0.92);
      // and it does finish
      expect(travelledAt(0.98)).toBeGreaterThan(0.97);
    }
  });

  it('fly-in window is long enough to track a full journey (≥ 3.5s)', () => {
    expect(ROTATION_GATHER_END - ROTATION_GATHER_START).toBeGreaterThanOrEqual(3500);
  });

  it('always samples the video at the landing slot, in every phase', () => {
    const phases = [
      0,
      ROTATION_HOLD1_END + 200,
      ROTATION_SCATTER_END - 100,
      ROTATION_GATHER_START + 300,
      ROTATION_GATHER_END - 100,
      ROTATION_TOTAL - 50,
    ];
    for (const d of defs) {
      for (const e of phases) {
        const p = rotationPieceAt(d, e);
        expect(p.slotLeft).toBe(d.slot.left);
        expect(p.slotTop).toBe(d.slot.top);
      }
    }
  });
});
