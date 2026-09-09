/**
 * Locks in the hero loop's two guarantees:
 *  - the wrap is seamless (piece pose at e=0 === pose at e=TOTAL)
 *  - every piece really scatters out and gathers back (not a static hold)
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
  it('has 11 real pieces', () => {
    expect(defs).toHaveLength(11);
    for (const d of defs) {
      expect(d.clip).toMatch(/^M /);
      expect(Number.isFinite(d.slot.left)).toBe(true);
      expect(Number.isFinite(d.scatter.left)).toBe(true);
    }
  });

  it('starts fully assembled: every piece in its hole, upright', () => {
    for (const d of defs) {
      const p = heroPieceAt(d, 0);
      expect(p.visible).toBe(true);
      expect(p.left).toBe(d.slot.left);
      expect(p.top).toBe(d.slot.top);
      expect(p.rot).toBe(0);
      expect(p.scale).toBe(1);
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

  it('scatters every piece fully off-frame at mid-scatter', () => {
    const mid = (HERO_SCATTER_END + HERO_GATHER_START) / 2;
    for (const d of defs) {
      const p = heroPieceAt(d, mid);
      expect(p.left).toBe(d.scatter.left);
      expect(p.top).toBe(d.scatter.top);
      const offFrame =
        p.left + p.w <= 0 || p.top + p.h <= 0 || p.left >= W || p.top >= H;
      expect(offFrame).toBe(true); // whole piece box is outside the hero frame
      const dist = Math.hypot(p.left - d.slot.left, p.top - d.slot.top);
      expect(dist).toBeGreaterThan(600); // travelled a real distance from home
    }
  });

  it('gathers smoothly back home — monotonic distance decrease, ends in the hole', () => {
    for (const d of defs) {
      const samples: number[] = [];
      for (let e = HERO_GATHER_START; e <= HERO_GATHER_END; e += 120) {
        const p = heroPieceAt(d, e);
        samples.push(Math.hypot(p.left - d.slot.left, p.top - d.slot.top));
      }
      // allow a tiny easeOutBack overshoot bump but the trend must be inward
      let regressions = 0;
      for (let i = 1; i < samples.length; i++)
        if (samples[i] > samples[i - 1] + 2) regressions++;
      expect(regressions).toBeLessThanOrEqual(1);

      const landed = heroPieceAt(d, HERO_GATHER_END);
      expect(Math.abs(landed.left - d.slot.left)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(landed.top - d.slot.top)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(landed.rot)).toBeLessThanOrEqual(0.5);
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
