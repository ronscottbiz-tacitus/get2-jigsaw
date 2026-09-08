/**
 * Top level: decide between the first-launch overview and the game. The
 * "seen it" flag is device-local (localStorage) — genuine first visit shows the
 * overview, every return visit goes straight to the puzzle. The in-app
 * "Overview" link brings it back without clearing the flag.
 */
import { useCallback, useState } from 'react';
import { JigsawGame } from './game/JigsawGame';
import { Welcome } from './components/welcome/Welcome';
import { hasWelcomed, markWelcomed, resetWelcomed } from './game/persistence';
import { DEFAULT_DIFFICULTY, DEFAULT_PIECE_COUNT } from './game/constants';
import type { Difficulty } from './game/types';

export default function App() {
  const [showWelcome, setShowWelcome] = useState(() => !hasWelcomed());

  const start = useCallback(() => {
    markWelcomed();
    setShowWelcome(false);
  }, []);

  const openOverview = useCallback(() => setShowWelcome(true), []);

  const devReset = useCallback(() => {
    resetWelcomed();
    window.location.reload();
  }, []);

  if (showWelcome) return <Welcome onStart={start} />;

  return (
    <JigsawGame
      defaultDifficulty={DEFAULT_DIFFICULTY as Difficulty}
      defaultPieceCount={DEFAULT_PIECE_COUNT}
      onShowWelcome={openOverview}
      onDevReset={devReset}
    />
  );
}
