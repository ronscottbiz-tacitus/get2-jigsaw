/**
 * Device-local persistence only (localStorage). Two keys:
 *  - best times, bucketed by puzzle config (image/video + difficulty + grid)
 *  - a single in-progress puzzle for mid-game resume
 * No accounts, no backend, no cross-device sync — deliberately out of scope.
 * Every access is guarded; a disabled/full/private-mode store degrades to "no
 * saved data" rather than throwing.
 */
import { BEST_TIMES_KEY, PROGRESS_KEY, WELCOMED_KEY } from './constants';
import type { ContentType, Difficulty, SavedProgress } from './types';

interface ConfigLike {
  contentType: ContentType;
  videoSrc: string;
  imageSrc: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
}

export function configKey(s: ConfigLike): string {
  const src = s.contentType === 'video' ? s.videoSrc : s.imageSrc;
  return `${src}|${s.difficulty}|${s.rows}x${s.cols}`;
}

/** Insert `time` (seconds) into this config's leaderboard, keep the best 5. */
export function recordBestTime(cfg: ConfigLike, time: number): void {
  const key = configKey(cfg);
  let all: Record<string, number[]> = {};
  try {
    all = JSON.parse(localStorage.getItem(BEST_TIMES_KEY) || '{}');
  } catch {
    all = {};
  }
  const list = (all[key] || [])
    .concat([time])
    .sort((a, b) => a - b)
    .slice(0, 5);
  all[key] = list;
  try {
    localStorage.setItem(BEST_TIMES_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export function bestTimesFor(cfg: ConfigLike): number[] {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_TIMES_KEY) || '{}');
    return all[configKey(cfg)] || [];
  } catch {
    return [];
  }
}

export function saveProgress(p: SavedProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as SavedProgress) : null;
  } catch {
    return null;
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Reject a saved blob that doesn't structurally match a real puzzle, so a
 * schema change or a corrupt write can't crash the resume path. */
export function isValidProgress(saved: unknown): saved is SavedProgress {
  if (!saved || typeof saved !== 'object') return false;
  const s = saved as Record<string, unknown>;
  if (!Array.isArray(s.pieces) || !s.pieces.length) return false;
  const rows = s.rows as number;
  const cols = s.cols as number;
  if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows <= 0 || cols <= 0)
    return false;
  if (s.pieces.length !== rows * cols) return false;
  if (!['easy', 'moderate', 'hard'].includes(s.difficulty as string)) return false;
  if (!Number.isFinite(s.elapsedSec as number)) return false;
  return true;
}

export function hasWelcomed(): boolean {
  try {
    return !!localStorage.getItem(WELCOMED_KEY);
  } catch {
    // If we can't read the flag, don't trap the user on the marketing page.
    return true;
  }
}

export function markWelcomed(): void {
  try {
    localStorage.setItem(WELCOMED_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

export function resetWelcomed(): void {
  try {
    localStorage.removeItem(WELCOMED_KEY);
  } catch {
    /* storage unavailable */
  }
}
