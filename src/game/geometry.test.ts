import { describe, it, expect } from 'vitest';
import { generateGeometry, trayScatterSlots } from './geometry';
import {
  BOARD_H,
  BOARD_W,
  DESKTOP_LAYOUT,
  PHONE_LAYOUT,
  PIECE_COUNT_PRESETS,
} from './constants';
import { clampAnchor } from './snap';

describe('phone layout — board on top, pieces in the tray', () => {
  for (const n of [25, 48, 96]) {
    it(`${n} pieces: homes sit on the board, scatter targets stay inside the tray`, () => {
      const [rows, cols] = PIECE_COUNT_PRESETS[n];
      const geo = generateGeometry(rows, cols, 'moderate', PHONE_LAYOUT);
      const tray = PHONE_LAYOUT.tray!;
      expect(geo.pieces).toHaveLength(n);
      for (const p of geo.pieces) {
        // padded box straddles the board edge by the tab pad, never more
        const pad = (p.boxW - BOARD_W / cols) / 2;
        expect(p.homeLeft).toBeGreaterThanOrEqual(PHONE_LAYOUT.boardX - pad - 0.001);
        expect(p.homeTop).toBeGreaterThanOrEqual(PHONE_LAYOUT.boardY - pad - 0.001);
        expect(p.homeLeft + p.boxW).toBeLessThanOrEqual(PHONE_LAYOUT.boardX + BOARD_W + pad + 0.001);
        expect(p.homeTop + p.boxH).toBeLessThanOrEqual(PHONE_LAYOUT.boardY + BOARD_H + pad + 0.001);

        expect(p.scatterLeft).toBeGreaterThanOrEqual(tray.x);
        expect(p.scatterTop).toBeGreaterThanOrEqual(tray.y);
        expect(p.scatterLeft + p.boxW).toBeLessThanOrEqual(tray.x + tray.w);
        expect(p.scatterTop + p.boxH).toBeLessThanOrEqual(tray.y + tray.h);
      }
    });
  }

  it('tray slots are spread out, not piled up', () => {
    const slots = trayScatterSlots(25, 245, 173, PHONE_LAYOUT.tray!);
    expect(slots).toHaveLength(25);
    const unique = new Set(slots.map((s) => `${Math.round(s.left / 40)}:${Math.round(s.top / 40)}`));
    expect(unique.size).toBeGreaterThan(20);
  });

  it('dragging is clamped to the phone stage, not the desktop one', () => {
    const geo = generateGeometry(5, 5, 'easy', PHONE_LAYOUT);
    const p = geo.pieces[0];
    const ids = new Set([p.id]);
    const far = clampAnchor(geo.pieces, 5000, 5000, ids, p.homeLeft, p.homeTop, PHONE_LAYOUT);
    expect(far.left + p.boxW).toBeCloseTo(PHONE_LAYOUT.w, 6);
    expect(far.top + p.boxH).toBeCloseTo(PHONE_LAYOUT.h, 6);
  });
});

describe('desktop layout is unchanged', () => {
  it('scatters anywhere on the 1120x760 stage with the board centred', () => {
    const geo = generateGeometry(6, 8, 'easy');
    const first = geo.pieces[0];
    const pad = (first.boxW - BOARD_W / 8) / 2;
    expect(first.homeLeft).toBeCloseTo(DESKTOP_LAYOUT.boardX - pad, 6);
    for (const p of geo.pieces) {
      expect(p.scatterLeft + p.boxW).toBeLessThanOrEqual(DESKTOP_LAYOUT.w);
      expect(p.scatterTop + p.boxH).toBeLessThanOrEqual(DESKTOP_LAYOUT.h);
    }
  });
});
