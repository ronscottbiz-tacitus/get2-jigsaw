/**
 * Jigsaw piece-shape generation.
 *
 * The one rule that must not be broken: every *interior* edge's tab/notch shape
 * is generated exactly once (into the `hEdge` / `vEdge` tables) and then
 * referenced by BOTH cells that share it. If each piece generated its own edges,
 * adjacent tabs and notches would not line up and the solved image would show
 * seams. `buildEdge` is also written so that tracing an edge from either
 * direction (t and 1-t) lands on identical control points.
 *
 * Ported from `Jigsaw Board.dc.html` → `randEdgeParams`, `buildEdge`,
 * `generateGeometry`.
 */
import {
  BOARD_W,
  BOARD_H,
  STAGE_W,
  STAGE_H,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
} from './constants';
import type { Difficulty, EdgeParams, Piece } from './types';

type Pt = { x: number; y: number };

export function randEdgeParams(): EdgeParams {
  return {
    dir: Math.random() < 0.5 ? 1 : -1,
    size: 0.85 + Math.random() * 0.45,
    pinch: 0.15 + Math.random() * 0.75,
  };
}

/**
 * Append one edge (from `P0` to `P1`) to an SVG path `d` string. A border edge
 * is a straight line; an interior edge is a symmetric tab/notch made of three
 * cubic Béziers. `outward` flips the bump to the other side of the line.
 */
export function buildEdge(
  P0: Pt,
  P1: Pt,
  isBorder: boolean,
  outward: boolean,
  params: Partial<EdgeParams>,
): string {
  if (isBorder) return ` L ${P1.x} ${P1.y}`;
  const dx = P1.x - P0.x;
  const dy = P1.y - P0.y;
  const L = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / L;
  const uy = dy / L;
  const nx = uy;
  const ny = -ux;
  const pt = (t: number): Pt => ({ x: P0.x + ux * t * L, y: P0.y + uy * t * L });
  // fixed, direction-symmetric params (t and 1-t both land on identical points)
  // so a shared edge traced from either neighbouring piece produces the exact
  // same curve — no seam / gap between them.
  const tN1 = 0.34;
  const tN2 = 0.66;
  const tS1 = 0.27;
  const tS2 = 0.73;
  const size = params.size ?? 1;
  const pinch = params.pinch ?? 0.5;
  const r = size * 0.17 * L;
  const sign = outward ? 1 : -1;
  const sox = nx * sign;
  const soy = ny * sign;
  const S1 = pt(tS1);
  const A = pt(tN1);
  const B = pt(tN2);
  const S2 = pt(tS2);
  const pinchAmt = pinch * r * 0.85;
  const bulgeAmt = r * 1.5;
  const c1a = { x: S1.x - sox * pinchAmt, y: S1.y - soy * pinchAmt };
  const c1b = { x: A.x - sox * pinchAmt * 0.55, y: A.y - soy * pinchAmt * 0.55 };
  const c2a = { x: A.x + sox * bulgeAmt, y: A.y + soy * bulgeAmt };
  const c2b = { x: B.x + sox * bulgeAmt, y: B.y + soy * bulgeAmt };
  const c3a = { x: B.x - sox * pinchAmt * 0.55, y: B.y - soy * pinchAmt * 0.55 };
  const c3b = { x: S2.x - sox * pinchAmt, y: S2.y - soy * pinchAmt };
  const f = (n: number) => n.toFixed(2);
  return (
    ` L ${f(S1.x)} ${f(S1.y)} C ${f(c1a.x)} ${f(c1a.y)} ${f(c1b.x)} ${f(c1b.y)} ${f(A.x)} ${f(A.y)}` +
    ` C ${f(c2a.x)} ${f(c2a.y)} ${f(c2b.x)} ${f(c2b.y)} ${f(B.x)} ${f(B.y)}` +
    ` C ${f(c3a.x)} ${f(c3a.y)} ${f(c3b.x)} ${f(c3b.y)} ${f(S2.x)} ${f(S2.y)} L ${P1.x} ${P1.y}`
  );
}

export interface PuzzleGeometry {
  pieces: Piece[];
  cellW: number;
  cellH: number;
  /** distance within which the magnetic pull toward a home/neighbour engages. */
  magnetRadius: number;
  /** hard tolerance for a connect / final snap. */
  snapTol: number;
}

/**
 * Build a full set of pieces for a `rows`x`cols` puzzle at the given difficulty.
 * The piece bounding box is padded by `min(cellW, cellH) * 0.4` on every side so
 * it always fully contains the tab bulge (an undersized pad causes visible gaps
 * between solved pieces). Pieces are positioned by shared grid coordinates, not
 * by an individually-computed offset.
 */
export function generateGeometry(
  rows: number,
  cols: number,
  difficulty: Difficulty,
): PuzzleGeometry {
  const cellW = BOARD_W / cols;
  const cellH = BOARD_H / rows;
  const pad = Math.min(cellW, cellH) * 0.4;
  const boxW = cellW + 2 * pad;
  const boxH = cellH + 2 * pad;

  // shared per-edge tables: one entry per interior boundary, referenced by both
  // neighbours below.
  const hEdge: EdgeParams[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    hEdge.push([]);
    for (let c = 0; c < cols; c++) hEdge[r].push(randEdgeParams());
  }
  const vEdge: EdgeParams[][] = [];
  for (let r = 0; r < rows; r++) {
    vEdge.push([]);
    for (let c = 0; c < cols - 1; c++) vEdge[r].push(randEdgeParams());
  }

  const pieces: Piece[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellLeft = c * cellW;
      const cellTop = r * cellH;
      const TL = { x: pad, y: pad };
      const TR = { x: pad + cellW, y: pad };
      const BR = { x: pad + cellW, y: pad + cellH };
      const BL = { x: pad, y: pad + cellH };
      const topEdge = r > 0 ? hEdge[r - 1][c] : null;
      const rightEdge = c < cols - 1 ? vEdge[r][c] : null;
      const bottomEdge = r < rows - 1 ? hEdge[r][c] : null;
      const leftEdge = c > 0 ? vEdge[r][c - 1] : null;
      const topOutward = topEdge ? topEdge.dir === -1 : false;
      const rightOutward = rightEdge ? rightEdge.dir === 1 : false;
      const bottomOutward = bottomEdge ? bottomEdge.dir === 1 : false;
      const leftOutward = leftEdge ? leftEdge.dir === -1 : false;
      const d =
        buildEdge(TL, TR, r === 0, topOutward, topEdge || {}) +
        buildEdge(TR, BR, c === cols - 1, rightOutward, rightEdge || {}) +
        buildEdge(BR, BL, r === rows - 1, bottomOutward, bottomEdge || {}) +
        buildEdge(BL, TL, c === 0, leftOutward, leftEdge || {});
      const pathD = `M ${TL.x} ${TL.y} ${d} Z`;
      const homeLeft = BOARD_OFFSET_X + cellLeft - pad;
      const homeTop = BOARD_OFFSET_Y + cellTop - pad;
      let rotation = 0;
      if (difficulty === 'moderate') rotation = 90 * Math.floor(Math.random() * 4);
      else if (difficulty === 'hard') rotation = Math.random() * 360;
      const scatterLeft = Math.round(Math.random() * (STAGE_W - boxW));
      const scatterTop = Math.round(Math.random() * (STAGE_H - boxH));
      const staggerDelay = Math.round(Math.random() * 150);
      const animDur = 480 + Math.round(Math.random() * 240);
      pieces.push({
        id: `${r}-${c}`,
        groupId: `${r}-${c}`,
        homeLeft,
        homeTop,
        curLeft: homeLeft,
        curTop: homeTop,
        scatterLeft,
        scatterTop,
        scatterRotation: rotation,
        rotation: 0,
        solved: false,
        boxW,
        boxH,
        bgPosX: -(cellLeft - pad),
        bgPosY: -(cellTop - pad),
        pathD,
        staggerDelay,
        animDur,
        zOrder: 0,
      });
    }
  }

  return {
    pieces,
    cellW,
    cellH,
    magnetRadius: Math.min(cellW, cellH) * 0.9,
    snapTol: Math.max(14, Math.min(cellW, cellH) * 0.24),
  };
}
