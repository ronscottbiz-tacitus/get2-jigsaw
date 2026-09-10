/**
 * Full drag-to-snap solve playthroughs.
 *
 * Mounts the real <JigsawGame>, breaks the puzzle apart, then drives it to
 * completion with real DOM pointer events on the piece nodes (and, for
 * Moderate, real clicks on the rotate handle). Nothing in the engine is called
 * directly — only events are dispatched and the public `state` is read.
 */
import { createRef } from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { JigsawGame } from './JigsawGame';
import {
  BEST_TIMES_KEY,
  PROGRESS_KEY,
  WAGER_BALANCE_KEY,
  WAGER_STAKE,
  wagerNet,
  wagerParSeconds,
  wagerPot,
} from './constants';
import { getWagerBalance, setWagerBalance } from './persistence';
import type { Piece } from './types';

beforeEach(() => {
  localStorage.clear();
});

type GameRef = InstanceType<typeof JigsawGame>;

async function mountAndScatter(props: {
  difficulty: 'easy' | 'moderate' | 'hard';
  pieceCount: number;
}) {
  const ref = createRef<GameRef>();
  const view = render(
    <JigsawGame
      ref={ref}
      defaultDifficulty={props.difficulty}
      defaultPieceCount={props.pieceCount}
    />,
  );
  const game = ref.current!;
  expect(game).toBeTruthy();
  expect(game.state.introPhase).toBe('hold');
  expect(game.state.pieces).toHaveLength(props.pieceCount);

  // tap-to-reveal: click the board, then wait out the scatter animation
  fireEvent.click(view.getByTestId('stage'));
  await waitFor(() => expect(game.state.introPhase).toBeNull(), { timeout: 10_000 });
  return { view, game };
}

/** Grab `piece` where it is and drop its anchor at (targetLeft, targetTop).
 * Each fireEvent flushes its own act() so state is fresh between events. */
function dragPieceTo(
  container: HTMLElement,
  piece: Piece,
  targetLeft: number,
  targetTop: number,
) {
  const el = container.querySelector<HTMLElement>(`[data-piece-id="${piece.id}"]`);
  if (!el) throw new Error(`no DOM node for piece ${piece.id}`);
  const dx = targetLeft - piece.curLeft;
  const dy = targetTop - piece.curTop;
  fireEvent.pointerDown(el, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
  fireEvent.pointerMove(el, { clientX: dx, clientY: dy, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: dx, clientY: dy, pointerId: 1 });
}

/** Select a piece and click the 90° rotate handle until it reads upright. */
function rotateUpright(view: ReturnType<typeof render>, game: GameRef, id: string) {
  for (let i = 0; i < 4; i++) {
    const p = game.state.pieces.find((x) => x.id === id)!;
    if (((p.rotation % 360) + 360) % 360 === 0) return;
    const el = view.container.querySelector<HTMLElement>(`[data-piece-id="${id}"]`)!;
    fireEvent.pointerDown(el, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(el, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.click(view.getByTestId('rotate-handle'));
  }
  const after = game.state.pieces.find((x) => x.id === id)!;
  expect(((after.rotation % 360) + 360) % 360).toBe(0);
}

async function expectWinCard(elapsedRecorded = true) {
  expect(await screen.findByText('Solved!', {}, { timeout: 3000 })).toBeTruthy();
  await screen.findByText(/Best times/i, {}, { timeout: 3000 });
  if (elapsedRecorded) {
    const best = JSON.parse(localStorage.getItem(BEST_TIMES_KEY) || '{}');
    const keys = Object.keys(best);
    expect(keys).toHaveLength(1);
    expect(best[keys[0]]).toHaveLength(1);
    expect(typeof best[keys[0]][0]).toBe('number');
  }
  expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
}

describe('drag-to-snap solve playthrough — Easy · 25 pieces', () => {
  it('drags every piece home, no gaps, win card + best time', async () => {
    const { view, game } = await mountAndScatter({ difficulty: 'easy', pieceCount: 25 });

    const scattered = game.state.pieces.filter(
      (p) => Math.hypot(p.curLeft - p.homeLeft, p.curTop - p.homeTop) > 5,
    );
    expect(scattered.length).toBeGreaterThan(20);

    for (let guard = 0; guard < 200; guard++) {
      const next = game.state.pieces.find((p) => !p.solved);
      if (!next) break;
      dragPieceTo(view.container, next, next.homeLeft, next.homeTop);
    }

    expect(game.state.solvedCount).toBe(25);
    expect(game.state.pieces.every((p) => p.solved)).toBe(true);
    for (const p of game.state.pieces) {
      // positioned by shared grid coordinates → adjacent solved pieces touch exactly
      expect(p.curLeft).toBe(p.homeLeft);
      expect(p.curTop).toBe(p.homeTop);
      expect(p.rotation).toBe(0);
    }
    await expectWinCard();
  }, 30_000);
});

describe('drag-to-snap solve playthrough — Moderate · 25 pieces', () => {
  it('rotates each piece upright with the 90° handle, then drags it home to solve', async () => {
    const { view, game } = await mountAndScatter({ difficulty: 'moderate', pieceCount: 25 });

    // at least some pieces start rotated (that's the whole point of Moderate)
    const rotatedAtStart = game.state.pieces.filter(
      (p) => (((p.rotation % 360) + 360) % 360) !== 0,
    );
    expect(rotatedAtStart.length).toBeGreaterThan(10);

    for (let guard = 0; guard < 200; guard++) {
      const next = game.state.pieces.find((p) => !p.solved);
      if (!next) break;
      rotateUpright(view, game, next.id);
      const fresh = game.state.pieces.find((p) => p.id === next.id)!;
      dragPieceTo(view.container, fresh, fresh.homeLeft, fresh.homeTop);
    }

    expect(game.state.solvedCount).toBe(25);
    expect(game.state.pieces.every((p) => p.solved && p.rotation === 0)).toBe(true);
    await expectWinCard();
  }, 45_000);
});

describe('connect + merge — Easy · 25 pieces', () => {
  it('merges two correctly-offset neighbours into one group, then the cluster snaps home together', async () => {
    const { view, game } = await mountAndScatter({ difficulty: 'easy', pieceCount: 25 });

    const a = game.state.pieces.find((p) => p.id === '2-2')!;
    const b = game.state.pieces.find((p) => p.id === '2-3')!;
    expect(a.groupId).not.toBe(b.groupId);

    dragPieceTo(view.container, a, 60, 60); // park A off its home

    const a2 = game.state.pieces.find((p) => p.id === '2-2')!;
    const offX = b.homeLeft - a.homeLeft;
    const offY = b.homeTop - a.homeTop;
    dragPieceTo(view.container, b, a2.curLeft + offX, a2.curTop + offY);

    const aG = game.state.pieces.find((p) => p.id === '2-2')!;
    const bG = game.state.pieces.find((p) => p.id === '2-3')!;
    expect(bG.groupId).toBe(aG.groupId); // merged, not yet solved
    expect(aG.solved).toBe(false);
    expect(bG.solved).toBe(false);
    expect(Math.abs(bG.curLeft - aG.curLeft - offX)).toBeLessThanOrEqual(1);
    expect(Math.abs(bG.curTop - aG.curTop - offY)).toBeLessThanOrEqual(1);

    const anchor = game.state.pieces.find((p) => p.id === aG.groupId) ?? aG;
    dragPieceTo(view.container, anchor, anchor.homeLeft, anchor.homeTop);

    expect(game.state.pieces.find((p) => p.id === '2-2')!.solved).toBe(true);
    expect(game.state.pieces.find((p) => p.id === '2-3')!.solved).toBe(true);
    expect(game.state.solvedCount).toBeGreaterThanOrEqual(2);
  }, 30_000);
});

describe('double-click pulls a solved piece back apart', () => {
  it('un-solves a placed piece and decrements the count', async () => {
    const { view, game } = await mountAndScatter({ difficulty: 'easy', pieceCount: 25 });

    const first = game.state.pieces[0];
    dragPieceTo(view.container, first, first.homeLeft, first.homeTop);
    expect(game.state.pieces.find((p) => p.id === first.id)!.solved).toBe(true);
    const solvedNow = game.state.solvedCount;

    const el = view.container.querySelector<HTMLElement>(
      `[data-piece-id="${first.id}"]`,
    )!;
    fireEvent.doubleClick(el);

    const after = game.state.pieces.find((p) => p.id === first.id)!;
    expect(after.solved).toBe(false);
    expect(game.state.solvedCount).toBe(solvedNow - 1);
  }, 30_000);
});

// -- wager mode -----------------------------------------------------------

describe('wager math (pure)', () => {
  it('par time scales by pieces and difficulty', () => {
    expect(wagerParSeconds(25, 'moderate')).toBe(25 * 3.2 * 1.0);
    expect(wagerParSeconds(25, 'easy')).toBe(25 * 3.2 * 0.75);
    expect(wagerParSeconds(25, 'hard')).toBe(25 * 3.2 * 1.35);
  });

  it('pot: $10 at t=0, exactly $5 at par, $0 floor at 2×par, never lower', () => {
    const par = wagerParSeconds(48, 'moderate');
    expect(wagerPot(0, par)).toBe(10);
    expect(wagerPot(par, par)).toBeCloseTo(5, 6);
    expect(wagerPot(2 * par, par)).toBe(0);
    expect(wagerPot(10 * par, par)).toBe(0); // clamped, not negative
  });

  it('net is capped at losing exactly the $5 stake', () => {
    const par = wagerParSeconds(25, 'easy');
    expect(wagerNet(0, par)).toBe(5); // pot 10 − stake 5
    expect(wagerNet(par, par)).toBeCloseTo(0, 6); // break-even
    expect(wagerNet(999_999, par)).toBe(-WAGER_STAKE); // worst case
  });

  it('getWagerBalance defaults to 0 and round-trips through localStorage', () => {
    localStorage.clear();
    expect(getWagerBalance()).toBe(0);
    setWagerBalance(-3.4);
    expect(getWagerBalance()).toBe(-3.4);
    setWagerBalance(12.6);
    expect(getWagerBalance()).toBe(12.6);
  });
});

describe('wager mode — integration', () => {
  it('toggle off (default): a normal solve writes no wager balance and shows no wager line', async () => {
    const { view, game } = await mountAndScatter({ difficulty: 'easy', pieceCount: 25 });
    expect(game.state.wagerActive).toBe(false);

    for (let g = 0; g < 200; g++) {
      const next = game.state.pieces.find((p) => !p.solved);
      if (!next) break;
      dragPieceTo(view.container, next, next.homeLeft, next.homeTop);
    }
    await expectWinCard();
    expect(screen.queryByText(/Wager (won|lost)/i)).toBeNull();
    expect(localStorage.getItem(WAGER_BALANCE_KEY)).toBeNull();
    expect(game.state.wagerResultNet).toBeNull();
  }, 30_000);

  it('toggle on, solve fast: nets a win, persists the balance, resets wagerActive, shows the result', async () => {
    localStorage.clear();
    setWagerBalance(2); // start with an existing fake balance
    const { view, game } = await mountAndScatter({ difficulty: 'easy', pieceCount: 25 });

    // arm the wager (button near the piece-count / difficulty controls)
    fireEvent.click(screen.getByRole('button', { name: /Wager \$5/i }));
    expect(game.state.wagerActive).toBe(true);
    expect(game.state.wagerParSec).toBeCloseTo(wagerParSeconds(25, 'easy'), 6);

    // the time chip is now the live pot ($10.00 at t≈0)
    expect(screen.getByText(/^\$\d+\.\d\d$/)).toBeTruthy();

    for (let g = 0; g < 200; g++) {
      const next = game.state.pieces.find((p) => !p.solved);
      if (!next) break;
      dragPieceTo(view.container, next, next.homeLeft, next.homeTop);
    }

    // solved near-instantly in jsdom → pot ~$10 → net ~+$5
    const net = game.state.wagerResultNet!;
    expect(net).toBeGreaterThan(4);
    expect(net).toBeLessThanOrEqual(5);
    expect(game.state.wagerActive).toBe(false); // reset after resolving
    expect(game.state.wagerBalance).toBeCloseTo(2 + net, 6);
    expect(getWagerBalance()).toBeCloseTo(2 + net, 6); // persisted

    await screen.findByText(/Wager won/i, {}, { timeout: 3000 });
    expect(screen.getByText(/\+\$/)).toBeTruthy();
  }, 30_000);

  it('toggle on, then run the pot to $0: chip floors at $0 with a "wager lost" label, play continues', async () => {
    localStorage.clear();
    const { view, game } = await mountAndScatter({ difficulty: 'easy', pieceCount: 25 });
    fireEvent.click(screen.getByRole('button', { name: /Wager \$5/i }));

    // fast-forward the clock past 2×par so the pot floors
    const par = game.state.wagerParSec;
    act(() => {
      game.setState({
        startTime: Date.now() - (2 * par + 30) * 1000,
        elapsedSec: Math.ceil(2 * par + 30),
      });
    });
    await waitFor(() => {
      // chip shows $0.00 and the lost label
      expect(screen.getByText('$0.00')).toBeTruthy();
    });
    expect(screen.getByText(/wager lost/i)).toBeTruthy();

    // puzzle is still fully playable — solve it and it resolves as a full loss
    for (let g = 0; g < 200; g++) {
      const next = game.state.pieces.find((p) => !p.solved);
      if (!next) break;
      dragPieceTo(view.container, next, next.homeLeft, next.homeTop);
    }
    expect(game.state.solvedCount).toBe(25);
    expect(game.state.wagerResultNet).toBe(-WAGER_STAKE);
    await screen.findByText(/Wager lost/i, {}, { timeout: 3000 });
  }, 30_000);
});
