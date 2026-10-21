/**
 * First-launch / "overview" experience, shown on genuine first visit (tracked in
 * localStorage) and reachable again from the in-app "Overview" link. Four
 * stacked full-height sections; a fixed Get2 logo (top-left) and a persistent
 * Start Playing pill (top-right) sit above everything. "Start Playing" anywhere
 * dismisses this and drops into the puzzle picker; tapping any library tile
 * opens the picker with that puzzle selected.
 * Ported from the prototype's `showWelcome` block.
 */
import { ACCENT } from '../../game/constants';
import { Hero } from './Hero';
import { LiveRow } from './LiveRow';
import { RotationDemo } from './RotationDemo';
import { CuratedGrid } from './CuratedGrid';
import { Pricing } from './Pricing';

interface Props {
  onStart: () => void;
  /** Open the picker with this puzzle preselected. */
  onPick: (contentType: 'static' | 'video', src: string) => void;
}

export function Welcome({ onStart, onPick }: Props) {
  return (
    <div
      style={{
        background: '#000',
        color: '#fff',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overflowX: 'hidden',
      }}
    >
      <a
        href="https://get2.one"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          top: 'max(24px, env(safe-area-inset-top, 0px))',
          left: 'max(24px, env(safe-area-inset-left, 0px))',
          zIndex: 80,
          display: 'block',
          animation: 'heroCopyIn .6s cubic-bezier(.22,1,.36,1)',
        }}
      >
        <img
          src="/uploads/get2-logo.png"
          alt="Get2"
          style={{
            height: 'clamp(36px, 11vw, 52px)',
            width: 'auto',
            display: 'block',
            opacity: 0.92,
          }}
        />
      </a>

      <div
        style={{
          position: 'fixed',
          top: 'max(20px, env(safe-area-inset-top, 0px))',
          right: 'max(20px, env(safe-area-inset-right, 0px))',
          zIndex: 80,
          animation: 'heroCopyIn .6s cubic-bezier(.22,1,.36,1)',
        }}
      >
        <button
          type="button"
          onClick={onStart}
          style={{
            display: 'inline-block',
            background: 'rgba(0,82,255,.08)',
            backdropFilter: 'blur(6px)',
            color: '#fff',
            fontSize: 'clamp(9px, 2.6vw, 12px)',
            fontWeight: 600,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            padding: 'clamp(8px, 2.2vw, 12px) clamp(14px, 5vw, 26px)',
            borderRadius: 100,
            border: `1px solid ${ACCENT}`,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Start Playing
        </button>
      </div>

      <Hero onStart={onStart} />
      <LiveRow onPick={(src) => onPick('video', src)} />
      <RotationDemo />
      <CuratedGrid onStart={onStart} onPick={onPick} />
      <Pricing />
    </div>
  );
}
