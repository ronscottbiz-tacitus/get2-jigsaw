/**
 * First-launch / "overview" experience, shown on genuine first visit (tracked in
 * localStorage) and reachable again from the in-app "Overview" link. Four
 * stacked full-height sections; a fixed Get2 logo (top-left) and a persistent
 * Start Playing pill (top-right) sit above everything. "Start Playing" anywhere
 * dismisses this and drops into the puzzle picker.
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
}

export function Welcome({ onStart }: Props) {
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
          top: 24,
          left: 24,
          zIndex: 80,
          display: 'block',
          animation: 'heroCopyIn .6s cubic-bezier(.22,1,.36,1)',
        }}
      >
        <img
          src="/uploads/get2-logo.png"
          alt="Get2"
          style={{ height: 52, width: 'auto', display: 'block', opacity: 0.92 }}
        />
      </a>

      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
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
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            padding: '12px 26px',
            borderRadius: 100,
            border: `1px solid ${ACCENT}`,
            cursor: 'pointer',
          }}
        >
          Start Playing
        </button>
      </div>

      <Hero onStart={onStart} />
      <LiveRow />
      <RotationDemo />
      <CuratedGrid onStart={onStart} />
      <Pricing />
    </div>
  );
}
