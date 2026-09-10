/**
 * Fixed board / stage geometry. Ported verbatim from the Claude Design prototype
 * (`Jigsaw Board.dc.html`). Every layout number in the engine is expressed
 * relative to this 1120x760 stage and the 840x480 board inside it — never
 * relative to the browser viewport. The stage is then uniformly scaled to fit
 * its host element (see `useStageScale` / `measureScale`).
 */
import type { Difficulty } from './types';

export const STAGE_W = 1120;
export const STAGE_H = 760;
export const BOARD_W = 840;
export const BOARD_H = 480;
export const BOARD_OFFSET_X = (STAGE_W - BOARD_W) / 2; // 140
export const BOARD_OFFSET_Y = (STAGE_H - BOARD_H) / 2; // 140

/**
 * A hair of extra scale on every rendered piece so adjacent clip-paths overlap
 * by a sub-pixel instead of leaving a hairline seam. Matches the prototype's
 * `BLEED` constant; the canvas (Live) renderer uses the same 1.014 factor.
 */
export const BLEED = 1.014;

/** Piece-count presets → [rows, cols]. */
export const PIECE_COUNT_PRESETS: Record<number, [number, number]> = {
  25: [5, 5],
  48: [6, 8],
  96: [8, 12],
};

export const DEFAULT_PIECE_COUNT = 48;
export const DEFAULT_DIFFICULTY = 'moderate' as const;

export const BEST_TIMES_KEY = 'jigsaw_best_times_v1';
export const PROGRESS_KEY = 'jigsaw_progress_v1';
export const WELCOMED_KEY = 'jigsaw_welcomed_v1';

/** Board background swatches, each paired with the board-outline colour that
 * reads against it. `hex` is the flat fill; a brushed-metal texture is tiled
 * over it at render time. */
export interface BgPreset {
  hex: string;
  outline: string;
}
export const BG_PRESETS: BgPreset[] = [
  { hex: '#333333', outline: 'rgba(255,255,255,0.28)' },
  { hex: '#5A7A94', outline: 'rgba(0,0,0,0.35)' },
  { hex: '#8B4A2E', outline: 'rgba(255,255,255,0.3)' },
  { hex: '#D8C9A8', outline: 'rgba(0,0,0,0.3)' },
];

// Placeholder is an SVG; a real raster (…grain.png) with the same stem can
// replace it — update this constant to match.
export const TEXTURE_URL = '/uploads/textures/brushed-metal-grain.png.svg';

export function bgCssFor(hex: string, tile: number): string {
  return `url('${TEXTURE_URL}') 0 0 / ${tile}px ${tile}px repeat, ${hex}`;
}

/** Brand colours (Get2 fixed layer). */
export const ACCENT = '#0052FF';
export const GAME_ACCENT = '#3fae7d'; // in-app control accent (flexible layer)

/* ------------------------------------------------------------------------- *
 *  Wager mode — an optional fake-money betting layer. Bet $5, it's matched
 *  into a $10 pot; the pot decays linearly and you settle up on solve. You
 *  can never lose more than the $5 stake (the pot floors at $0 → net -$5).
 *  Fake balance only; localStorage, no backend.
 * ------------------------------------------------------------------------- */

/** Base "par" pace: seconds of allowance per piece before difficulty scaling. */
export const WAGER_SEC_PER_PIECE = 3.2;

/** Difficulty multiplier on the par time — harder tiers get more slack. */
export const WAGER_DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 0.75,
  moderate: 1.0,
  hard: 1.35,
};

/** Target solve time for this round. Pot = $10 at t=0, exactly $5 (break-even)
 * at `parSeconds`, and $0 at `2 * parSeconds`. */
export function wagerParSeconds(
  pieceCount: number,
  difficulty: Difficulty,
): number {
  return pieceCount * WAGER_SEC_PER_PIECE * WAGER_DIFFICULTY_MULTIPLIER[difficulty];
}

export const WAGER_STAKE = 5;
export const WAGER_POT = 10;
export const WAGER_BALANCE_KEY = 'jigsaw_wager_balance_v1';

/** Live pot value at `elapsedSec`, linear from $10 down to a $0 floor. */
export function wagerPot(elapsedSec: number, parSeconds: number): number {
  if (!(parSeconds > 0)) return 0;
  const raw = WAGER_POT - (WAGER_STAKE / parSeconds) * elapsedSec;
  return Math.min(WAGER_POT, Math.max(0, raw));
}

/** Net result if the round resolves now: pot minus the $5 stake. The pot floor
 * at $0 already caps the loss at exactly the stake. */
export function wagerNet(elapsedSec: number, parSeconds: number): number {
  return wagerPot(elapsedSec, parSeconds) - WAGER_STAKE;
}
