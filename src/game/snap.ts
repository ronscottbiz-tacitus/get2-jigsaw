/**
 * Connection + magnetic-snap math. Pure functions over a piece array; the
 * component layer applies the result (setState) and fires sound / glow.
 * Ported from `Jigsaw Board.dc.html`: `isRotationOk`, `deriveClusterPositions`,
 * `clampAnchor`, `computeMagnetOffset`, `tryConnectAndSnap`.
 */
import { STAGE_W, STAGE_H } from './constants';
import type { Difficulty, Piece } from './types';

/** Is `rot` close enough to a correct orientation for this difficulty?
 *  easy: always (no rotation). moderate: within 1° of a multiple of 360°
 *  (i.e. effectively exact, since moderate snaps to 90° steps). hard: within 8°. */
export function isRotationOk(rot: number, difficulty: Difficulty): boolean {
  if (difficulty === 'easy') return true;
  const n = ((rot % 360) + 360) % 360;
  const dist = Math.min(n, 360 - n);
  if (difficulty === 'moderate') return dist < 1;
  return dist <= 8;
}

export function groupMembers(pieces: Piece[], groupId: string): Piece[] {
  return pieces.filter((p) => p.groupId === groupId && !p.solved);
}

export function groupSize(pieces: Piece[], groupId: string): number {
  return groupMembers(pieces, groupId).length;
}

/** Move every member of a cluster so the anchor sits at (anchorLeft, anchorTop),
 * preserving each member's fixed offset from the anchor's home slot. */
export function deriveClusterPositions(
  pieces: Piece[],
  memberIds: Set<string>,
  anchorHomeLeft: number,
  anchorHomeTop: number,
  anchorLeft: number,
  anchorTop: number,
): Piece[] {
  return pieces.map((p) =>
    memberIds.has(p.id)
      ? {
          ...p,
          curLeft: anchorLeft + (p.homeLeft - anchorHomeLeft),
          curTop: anchorTop + (p.homeTop - anchorHomeTop),
        }
      : p,
  );
}

/** Keep a dragged cluster's bounding box inside the stage. */
export function clampAnchor(
  pieces: Piece[],
  anchorLeft: number,
  anchorTop: number,
  memberIds: Set<string>,
  anchorHomeLeft: number,
  anchorHomeTop: number,
): { left: number; top: number } {
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  pieces.forEach((p) => {
    if (!memberIds.has(p.id)) return;
    const left = anchorLeft + (p.homeLeft - anchorHomeLeft);
    const top = anchorTop + (p.homeTop - anchorHomeTop);
    minLeft = Math.min(minLeft, left);
    minTop = Math.min(minTop, top);
    maxRight = Math.max(maxRight, left + p.boxW);
    maxBottom = Math.max(maxBottom, top + p.boxH);
  });
  let dxAdj = 0;
  let dyAdj = 0;
  if (minLeft < 0) dxAdj = -minLeft;
  else if (maxRight > STAGE_W) dxAdj = STAGE_W - maxRight;
  if (minTop < 0) dyAdj = -minTop;
  else if (maxBottom > STAGE_H) dyAdj = STAGE_H - maxBottom;
  return { left: anchorLeft + dxAdj, top: anchorTop + dyAdj };
}

export interface MagnetOffset {
  dx: number;
  dy: number;
  pull: number;
}

/**
 * If the dragged group is within `magnetRadius` of its correct home, or of a
 * correctly-oriented neighbour it could connect to, return a partial offset
 * that eases it toward that target (stronger the closer it is). Returns null if
 * nothing is in range or rotation isn't valid yet.
 */
export function computeMagnetOffset(
  groupId: string,
  pieces: Piece[],
  difficulty: Difficulty,
  magnetRadius: number,
): MagnetOffset | null {
  const tol = magnetRadius;
  const members = groupMembers(pieces, groupId);
  if (!members.length) return null;
  let best: { dx: number; dy: number; dist: number } | null = null;
  const anchor = members[0];
  if (isRotationOk(anchor.rotation, difficulty)) {
    const dx = anchor.homeLeft - anchor.curLeft;
    const dy = anchor.homeTop - anchor.curTop;
    const dist = Math.hypot(dx, dy);
    if (dist < tol) best = { dx, dy, dist };
  }
  for (const p of members) {
    const [r, c] = p.id.split('-').map(Number);
    for (const [nr, nc] of [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ]) {
      const q = pieces.find((pp) => pp.id === `${nr}-${nc}`);
      if (!q || q.solved || q.groupId === groupId) continue;
      if (!isRotationOk(p.rotation, difficulty) || !isRotationOk(q.rotation, difficulty))
        continue;
      const targetLeft = q.curLeft + (p.homeLeft - q.homeLeft);
      const targetTop = q.curTop + (p.homeTop - q.homeTop);
      const dx = targetLeft - p.curLeft;
      const dy = targetTop - p.curTop;
      const dist = Math.hypot(dx, dy);
      if (dist < tol && (!best || dist < best.dist)) best = { dx, dy, dist };
    }
  }
  if (!best) return null;
  const t = 1 - best.dist / tol;
  const pull = Math.min(1, Math.pow(t, 1.6) * 1.15);
  return { dx: best.dx * pull, dy: best.dy * pull, pull };
}

export interface ConnectResult {
  pieces: Piece[];
  connected: boolean;
  newlySolved: number;
  checkGroup: string;
}

/**
 * On drop: look for a neighbouring group whose relative position (and rotation)
 * matches within `snapTol`. If found, merge the dragged group into it (rounding
 * to whole pixels, resetting rotation to 0). Then, if the resulting group is
 * within tolerance of its true home slot and correctly oriented, lock the whole
 * cluster solved. Returns null when nothing connected and nothing solved.
 */
export function tryConnectAndSnap(
  groupId: string,
  pieces: Piece[],
  difficulty: Difficulty,
  snapTol: number,
): ConnectResult | null {
  const tol = snapTol;
  const members = groupMembers(pieces, groupId);
  if (!members.length) return null;

  let match: { dx: number; dy: number; targetGroup: string } | null = null;
  for (const p of members) {
    const [r, c] = p.id.split('-').map(Number);
    for (const [nr, nc] of [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ]) {
      const q = pieces.find((pp) => pp.id === `${nr}-${nc}`);
      if (!q || q.solved || q.groupId === groupId) continue;
      if (!isRotationOk(p.rotation, difficulty) || !isRotationOk(q.rotation, difficulty))
        continue;
      const cdx = q.homeLeft - p.homeLeft;
      const cdy = q.homeTop - p.homeTop;
      const adx = q.curLeft - p.curLeft;
      const ady = q.curTop - p.curTop;
      if (Math.abs(adx - cdx) < tol && Math.abs(ady - cdy) < tol) {
        match = { dx: cdx - adx, dy: cdy - ady, targetGroup: q.groupId };
        break;
      }
    }
    if (match) break;
  }

  let newPieces = pieces;
  let connected = false;
  let checkGroup = groupId;
  if (match) {
    const movingIds = new Set(members.map((p) => p.id));
    const anchor = members[0];
    const newAnchorLeft = Math.round(anchor.curLeft + match.dx);
    const newAnchorTop = Math.round(anchor.curTop + match.dy);
    newPieces = deriveClusterPositions(
      pieces,
      movingIds,
      anchor.homeLeft,
      anchor.homeTop,
      newAnchorLeft,
      newAnchorTop,
    ).map((p) =>
      movingIds.has(p.id)
        ? { ...p, rotation: 0, groupId: match!.targetGroup }
        : p,
    );
    connected = true;
    checkGroup = match.targetGroup;
  }

  const members2 = newPieces.filter((p) => p.groupId === checkGroup && !p.solved);
  let newlySolved = 0;
  if (members2.length) {
    const anchor = members2[0];
    const posOk =
      Math.abs(anchor.curLeft - anchor.homeLeft) < tol &&
      Math.abs(anchor.curTop - anchor.homeTop) < tol;
    const rotOk = isRotationOk(anchor.rotation, difficulty);
    if (posOk && rotOk) {
      const ids = new Set(members2.map((m) => m.id));
      newPieces = newPieces.map((p) =>
        ids.has(p.id)
          ? { ...p, curLeft: p.homeLeft, curTop: p.homeTop, rotation: 0, solved: true }
          : p,
      );
      newlySolved = members2.length;
    }
  }

  if (!connected && newlySolved === 0) return null;
  return { pieces: newPieces, connected, newlySolved, checkGroup };
}
