/**
 * Top level: three screens.
 *  - welcome: the first-launch overview (genuine first visit only — tracked in
 *    localStorage — and reachable again from the picker's logo / "About").
 *  - picker: choose a puzzle and set it up. Every round starts here, and it's
 *    where a returning visitor lands (with a "Continue" card for a saved game).
 *  - game: the puzzle itself. Remounted (fresh `key`) for every new round.
 */
import { useCallback, useMemo, useState } from 'react';
import { JigsawGame } from './game/JigsawGame';
import { Welcome } from './components/welcome/Welcome';
import { Picker, type ResumeInfo } from './components/picker/Picker';
import {
  hasWelcomed,
  isValidProgress,
  loadProgress,
  markWelcomed,
  resetWelcomed,
} from './game/persistence';
import { imageBySrc, labelForSrc, videoBySrc } from './content/library';
import type { ContentType, PuzzleConfig, SavedProgress } from './game/types';

type View =
  | { name: 'welcome' }
  | { name: 'picker'; initial?: { contentType: ContentType; src: string } }
  | { name: 'game'; config?: PuzzleConfig; resume: boolean; key: number };

const DIFF = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' } as const;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function resumeInfoFrom(saved: SavedProgress | null): ResumeInfo | null {
  if (!saved || !isValidProgress(saved)) return null;
  const isVideo = saved.contentType === 'video';
  const n = saved.rows * saved.cols;
  const placed = saved.pieces.filter((p) => p.solved).length;
  return {
    title: labelForSrc(saved.contentType, isVideo ? saved.videoSrc : saved.imageSrc),
    summary: `${DIFF[saved.difficulty]} · ${placed}/${n} placed · ${fmt(saved.elapsedSec)}`,
    thumb: isVideo
      ? videoBySrc(saved.videoSrc)?.poster ?? ''
      : imageBySrc(saved.imageSrc)?.thumb ?? saved.imageSrc,
  };
}

let gameKey = 0;

export default function App() {
  const [view, setView] = useState<View>(() =>
    hasWelcomed() ? { name: 'picker' } : { name: 'welcome' },
  );

  const toPicker = useCallback((initial?: { contentType: ContentType; src: string }) => {
    markWelcomed();
    setView({ name: 'picker', initial });
    window.scrollTo(0, 0);
  }, []);

  const play = useCallback((config: PuzzleConfig) => {
    setView({ name: 'game', config, resume: false, key: ++gameKey });
  }, []);

  const resume = useCallback(() => {
    setView({ name: 'game', resume: true, key: ++gameKey });
  }, []);

  const openOverview = useCallback(() => {
    setView({ name: 'welcome' });
    window.scrollTo(0, 0);
  }, []);

  const devReset = useCallback(() => {
    resetWelcomed();
    window.location.reload();
  }, []);

  // re-read the save each time the picker opens (the game persists on exit)
  const resumeInfo = useMemo(
    () => (view.name === 'picker' ? resumeInfoFrom(loadProgress()) : null),
    [view],
  );

  if (view.name === 'welcome') {
    return (
      <Welcome
        onStart={() => toPicker()}
        onPick={(contentType, src) => toPicker({ contentType, src })}
      />
    );
  }

  if (view.name === 'picker') {
    return (
      <Picker
        initial={view.initial}
        resume={resumeInfo}
        onResume={resume}
        onStart={play}
        onOverview={openOverview}
      />
    );
  }

  const cfg = view.config;
  return (
    <JigsawGame
      key={view.key}
      config={cfg}
      resume={view.resume}
      onExit={() => toPicker(cfg ? { contentType: cfg.contentType, src: cfg.src } : undefined)}
      onPlay={play}
      onShowWelcome={openOverview}
      onDevReset={devReset}
    />
  );
}
