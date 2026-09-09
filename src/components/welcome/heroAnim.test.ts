/**
 * Locks in the hero loop's guarantees:
 *  - the wrap is seamless (piece pose at e=0 === pose at e=TOTAL)
 *  - every piece scatters to the OPPOSITE side and travels a long way
 *  - the fly-in rotates home through 90° steps with a spring bounce, landing
 *    upright
 *  - the video crop anchor is always the landing slot, in every phase.
 */
import { describe, it, expect } from 'vitest';
import {
  getHeroPieceDefs,
  heroPieceAt,
  HERO_HOLD1_END,
  HERO_SCATTER_END,
  HERO_GATHER_START,
  HERO_GATHER_END,
  HERO_TOTAL,
} from './heroAnim';

const W = 1440;
const H = 810;
const defs = getHeroPieceDefs(W, H);

describe('hero choreography', () => {
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
      const p = heroPieceAt(d, 0);
      expect(p).toMatchObject({ visible: true, rot: 0, scale: 1 });
      expect(p.left).toBe(d.slot.left);
      expect(p.top).toBe(d.slot.top);
    }
  });

  it('loops seamlessly — pose at e=0 matches pose at the last ms', () => {
    for (const d of defs) {
      const a = heroPieceAt(d, 0);
      const z = heroPieceAt(d, HERO_TOTAL - 1);
      expect(Math.abs(a.left - z.left)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.top - z.top)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.rot - z.rot)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.scale - z.scale)).toBeLessThanOrEqual(0.01);
    }
  });

  it('scatters to the opposite side of the frame — long travel, fully off-frame', () => {
    const mid = (HERO_SCATTER_END + HERO_GATHER_START) / 2;
    const cx = W / 2;
    const cy = H / 2;
    for (const d of defs) {
      const p = heroPieceAt(d, mid);
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
      const near = heroPieceAt(d, HERO_GATHER_START + d.delay + 10);
      expect(Math.abs(near.rot - startRot)).toBeLessThan(90);

      let maxScale = 1;
      let minSpun = Infinity; // spinDir*rot; goes negative when it overshoots upright
      let maxAbsRot = 0;
      let holdFrames = 0; // consecutive samples near an overshoot peak
      let run = 0;
      for (let e = HERO_GATHER_START; e < HERO_GATHER_END; e += 30) {
        const p = heroPieceAt(d, e);
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

      const landed = heroPieceAt(d, HERO_GATHER_END);
      expect(Math.abs(landed.rot)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(landed.scale - 1)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(landed.left - d.slot.left)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(landed.top - d.slot.top)).toBeLessThanOrEqual(0.5);
    }
  });

  it('every 90° step runs at the same wall-clock tempo regardless of step count', () => {
    // a 1-step and a 4-step piece should take the same time per quarter-turn
    const perStepMs = 600; // HERO_STEP_MS
    for (const d of defs) {
      // the turn of the first step completes within ~turnPortion*perStepMs
      const start = HERO_GATHER_START + d.delay;
      const afterFirstTurn = heroPieceAt(d, start + perStepMs * 0.42 + 5);
      const firstTarget = d.spinDir * (d.steps * 90 - 90);
      expect(Math.abs(afterFirstTurn.rot - firstTarget)).toBeLessThan(30);
      // all steps done by steps*perStepMs (+ a little) — upright well before it seats
      const doneRot = heroPieceAt(d, start + d.steps * perStepMs + 40).rot;
      expect(Math.abs(doneRot)).toBeLessThanOrEqual(0.5);
    }
  });

  it('fly-in position eases straight home (no overshoot)', () => {
    for (const d of defs) {
      const samples: number[] = [];
      for (let e = HERO_GATHER_START; e <= HERO_GATHER_END; e += 120) {
        const p = heroPieceAt(d, e);
        samples.push(Math.hypot(p.left - d.slot.left, p.top - d.slot.top));
      }
      let regressions = 0;
      for (let i = 1; i < samples.length; i++)
        if (samples[i] > samples[i - 1] + 2) regressions++;
      expect(regressions).toBe(0);
    }
  });

  it('always samples the video at the landing slot, in every phase', () => {
    const phases = [
      0,
      HERO_HOLD1_END + 200,
      HERO_SCATTER_END - 100,
      HERO_GATHER_START + 300,
      HERO_GATHER_END - 100,
      HERO_TOTAL - 50,
    ];
    for (const d of defs) {
      for (const e of phases) {
        const p = heroPieceAt(d, e);
        expect(p.slotLeft).toBe(d.slot.left);
        expect(p.slotTop).toBe(d.slot.top);
      }
    }
  });
});
