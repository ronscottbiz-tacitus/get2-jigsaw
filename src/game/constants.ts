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
/** Phones default to the smallest grid — 48 pieces on a ~360px-wide board is
 * a squint. Players can still pick more in the picker. */
export const DEFAULT_PIECE_COUNT_PHONE = 25;

/* ------------------------------------------------------------------------- *
 *  Stage layouts. The board is always 840x480 (piece geometry depends on it);
 *  what changes is the stage around it.
 *   - desktop: the original 1120x760 stage, board centred, pieces scatter
 *     anywhere on the stage.
 *   - phone: a tall, narrow stage — board pinned to the top at near full
 *     width, and a "tray" below it that the pieces break apart into, so the
 *     board gets the screen width and the pieces get the leftover height.
 *  A game's layout is fixed when it starts (home coordinates depend on it).
 * ------------------------------------------------------------------------- */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface StageLayout {
  kind: 'desktop' | 'phone';
  w: number;
  h: number;
  boardX: number;
  boardY: number;
  /** Region pieces scatter into. null = anywhere on the stage. */
  tray: Rect | null;
}

export const DESKTOP_LAYOUT: StageLayout = {
  kind: 'desktop',
  w: STAGE_W,
  h: STAGE_H,
  boardX: BOARD_OFFSET_X,
  boardY: BOARD_OFFSET_Y,
  tray: null,
};

const PHONE_MARGIN = 24;
const PHONE_TRAY_GAP = 40;
const PHONE_STAGE_H = 1600;
export const PHONE_LAYOUT: StageLayout = {
  kind: 'phone',
  w: BOARD_W + PHONE_MARGIN * 2,
  h: PHONE_STAGE_H,
  boardX: PHONE_MARGIN,
  boardY: PHONE_MARGIN,
  tray: {
    x: 0,
    y: PHONE_MARGIN + BOARD_H + PHONE_TRAY_GAP,
    w: BOARD_W + PHONE_MARGIN * 2,
    h: PHONE_STAGE_H - (PHONE_MARGIN + BOARD_H + PHONE_TRAY_GAP),
  },
};

export function layoutFor(kind: StageLayout['kind'] | undefined): StageLayout {
  return kind === 'phone' ? PHONE_LAYOUT : DESKTOP_LAYOUT;
}

export function isPhoneViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
}
export const DEFAULT_DIFFICULTY = 'moderate' as const;

/** At or below this viewport width the game uses the phone chrome (compact
 * bar, full-width dock, bottom sheets) and new puzzles start on the phone
 * stage layout (board on top, piece tray below). */
export const MOBILE_BREAKPOINT = 640;

export const BEST_TIMES_KEY = 'jigsaw_best_times_v1';
export const PROGRESS_KEY = 'jigsaw_progress_v1';
export const WELCOMED_KEY = 'jigsaw_welcomed_v1';
export const SOUND_MUTED_KEY = 'jigsaw_sound_muted_v1';

/** Board background swatches, each paired with the board-outline colour that
 * reads against it. `hex` is the flat fill/identity colour; `css`, when set,
 * is the actual rendered background (a real marble photo, in this case). */
export interface BgPreset {
  hex: string;
  outline: string;
  /** Border style for the board outline. Defaults to 'dashed'. */
  outlineStyle?: 'dashed' | 'dotted';
  /** Full CSS `background` value overriding the tiled-texture default
   * (`bgCssFor`). Use for presets that aren't a flat colour + metal grain. */
  css?: string;
}

/** Each non-black preset's `css` points at a real marble/stone photo in
 * public/uploads/textures/; `hex` is kept as a flat-color fallback if the
 * image fails to load, and as the stored/compared identity for "which
 * preset is selected." */
export const BG_PRESETS: BgPreset[] = [
  {
    hex: '#333333',
    outline: 'rgba(255,255,255,0.28)',
    css: "url('/uploads/textures/marble-charcoal.jpg') center/cover, #333333",
  },
  {
    hex: '#5A7A94',
    outline: 'rgba(0,0,0,0.35)',
    css: "url('/uploads/textures/marble-blue.jpg') center/cover, #5A7A94",
  },
  {
    hex: '#8B4A2E',
    outline: 'rgba(255,255,255,0.3)',
    css: "url('/uploads/textures/marble-tan.jpg') center/cover, #8B4A2E",
  },
  {
    hex: '#D8C9A8',
    outline: 'rgba(0,0,0,0.3)',
    css: "url('/uploads/textures/marble-white.jpg') center/cover, #D8C9A8",
  },
  {
    hex: '#000000',
    outline: '#0052FF', // matches ACCENT below
    outlineStyle: 'dotted',
    css: '#000000',
  },
];
// Placeholder is an SVG; a real raster (…grain.png) with the same stem can
// replace it — update this constant to match.
export const TEXTURE_URL = '/uploads/textures/brushed-metal-grain.png.svg';

export function bgCssFor(hex: string, tile: number): string {
  return `url('${TEXTURE_URL}') 0 0 / ${tile}px ${tile}px repeat, ${hex}`;
}

/** Brand colours (Get2 fixed layer). */
export const ACCENT = '#0052FF';
/** In-app control accent — Get2Puzzle's per-product color from the Get2
 * design system (`accent-get2puzzle`). Brand blue stays on primary CTAs. */
export const GAME_ACCENT = '#8B5CF6';
/** Filled controls with white text (passes 4.5:1 where #8B5CF6 doesn't). */
export const GAME_ACCENT_STRONG = '#7C3AED';
/** Accent used as text on dark backgrounds. */
export const GAME_ACCENT_TEXT = '#A78BFA';
export const GAME_ACCENT_SOFT = 'rgba(124,58,237,0.18)';
export const GAME_ACCENT_BORDER = 'rgba(139,92,246,0.55)';

/** Get2 fixed-layer tokens (from the Get2 design system). */
export const G2 = {
  bgPage: '#050506',
  bgPanel: '#0c0d10',
  bgPanelAlt: '#0b0c0f',
  textBody: '#F5F6F8',
  textHeading: '#fff',
  textSecondary: '#C7CAD1',
  textTertiary: '#8A8F98',
  textMuted: '#7B818C',
  blue: '#0052FF',
  blueLight: '#6C93FF',
  borderSubtle: 'rgba(255,255,255,0.08)',
  borderDefault: 'rgba(255,255,255,0.1)',
  fontDisplay: "'Archivo Expanded', 'Archivo', 'Plus Jakarta Sans', sans-serif",
  fontCondensed: "'Archivo Narrow', 'Archivo', 'Plus Jakarta Sans', sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  fontBody: "'Plus Jakarta Sans', system-ui, sans-serif",
} as const;

export const LAST_SETUP_KEY = 'jigsaw_last_setup_v1';

/* ------------------------------------------------------------------------- *
 *  Wager mode — an optional fake-money betting layer. Bet $5, it's matched
 *  into a $10 pot; the pot decays linearly and you settle up on solve. You
 *  can never lose more than the $5 stake (the pot floors at $0 → net -$5).
 *  Fake balance only; localStorage, no backend.
 * ------------------------------------------------------------------------- */

/** Base "par" pace: seconds of allowance per piece before difficulty scaling.
 * 11.2 = 3.5x the original 3.2s/piece — first pass at "way too hard"; retune
 * once we have a feel for real solve times. */
export const WAGER_SEC_PER_PIECE = 11.2;

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

export function wagerUrgency(pot: number): number {
  const u = 1 - Math.min(1, Math.max(0, pot / WAGER_POT));
  return u < 0.6 ? (u / 0.6) * 0.5 : 0.5 + ((u - 0.6) / 0.4) * 0.5;
}

export function wagerColorFor(urgency: number): string {
  const u = Math.min(1, Math.max(0, urgency));
  const green: [number, number, number] = [63, 174, 125];
  const amber: [number, number, number] = [239, 170, 39];
  const red: [number, number, number] = [229, 72, 77];
  const [c1, c2, t] =
    u < 0.5
      ? [green, amber, u / 0.5]
      : [amber, red, (u - 0.5) / 0.5];
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(c1[0], c2[0])}, ${mix(c1[1], c2[1])}, ${mix(c1[2], c2[2])})`;
}

export function wagerTickIntervalMs(parSeconds: number): number {
  if (!(parSeconds > 0)) return 0;
  const step = 0.05;
  return Math.max(50, Math.round((step * parSeconds) / WAGER_STAKE * 1000));
}

/* ------------------------------------------------------------------------- *
 *  Hints — 10 free per puzzle attempt (see FREE_HINTS in JigsawGame state),
 *  with extra packs purchasable from the fake wager balance. Priced per
 *  difficulty tier, not flat: a 96-piece hard puzzle burns through hints far
 *  faster than a 25-piece easy one, so a flat price would make hard-mode
 *  top-ups either a rip-off on easy or a rounding error on hard.
 * ------------------------------------------------------------------------- */

export const FREE_HINTS = 10;

export const HINT_PACK_SIZE = 5;

export const HINT_PACK_PRICE: Record<Difficulty, number> = {
  easy: 2,
  moderate: 4,
  hard: 7,
};

/** Play-money amount with a real minus sign: 2.1 → "$2.10", -0.57 → "−$0.57". */
export function formatMoney(n: number): string {
  return `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;
}
