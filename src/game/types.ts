export type Difficulty = 'easy' | 'moderate' | 'hard';

/** "Classic" (static image) vs "Live" (looping video). */
export type ContentType = 'static' | 'video';

/** Render path: image mode is DOM + clip-path; video mode is a single canvas. */
export type RenderMode = 'image' | 'video';

/** Intro state machine: `hold` = solved preview waiting for a tap,
 * `breaking` = scatter animation running, `null` = interactive. */
export type IntroPhase = 'hold' | 'breaking' | null;

/**
 * One puzzle piece. Positions are in stage coordinates (the 1120x760 space).
 * `home*` is the solved slot; `cur*` is where the piece is right now;
 * `scatter*` is its break-apart target. `groupId` is the id of the cluster the
 * piece currently belongs to (starts equal to `id`; pieces merge groups as they
 * connect). Geometry (`boxW/boxH`, `pathD`, `bgPos*`) is fixed for the life of
 * the puzzle.
 */
export interface Piece {
  id: string; // `${row}-${col}`
  groupId: string;
  homeLeft: number;
  homeTop: number;
  curLeft: number;
  curTop: number;
  scatterLeft: number;
  scatterTop: number;
  scatterRotation: number;
  rotation: number;
  solved: boolean;
  boxW: number;
  boxH: number;
  /** background-position for the image crop, relative to the 840x480 board. */
  bgPosX: number;
  bgPosY: number;
  pathD: string;
  staggerDelay: number;
  animDur: number;
  /** Bumped to a fresh, higher value whenever this piece's group is picked
   * up. Used to break ties among idle pieces so the one you last touched
   * always renders above ones you haven't — otherwise overlapping idle
   * pieces stack in arbitrary creation order and the top one can be
   * unclickable. */
  zOrder: number;
}

/** Per-edge tab/notch parameters. Generated once per interior edge and shared
 * by both neighbouring cells so their curves are identical (no seam / gap). */
export interface EdgeParams {
  dir: 1 | -1;
  size: number;
  pinch: number;
}

export interface SavedProgress {
  pieces: Piece[];
  rows: number;
  cols: number;
  difficulty: Difficulty;
  contentType: ContentType;
  imageSrc: string;
  videoSrc: string;
  bgColor: string;
  elapsedSec: number;
  savedAt: number;
}
