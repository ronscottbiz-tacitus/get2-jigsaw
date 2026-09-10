import { WAGER_POT, WAGER_STAKE, wagerColorFor, wagerUrgency } from '../game/constants';

interface Props {
  pot: number;
  lost: boolean;
}

export function WagerGauge({ pot, lost }: Props) {
  const clamped = Math.min(WAGER_POT, Math.max(0, pot));
  const pct = (clamped / WAGER_POT) * 100;
  const color = wagerColorFor(wagerUrgency(clamped));
  const breakEvenPct = (WAGER_STAKE / WAGER_POT) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color,
            transition: 'color 200ms linear',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ${clamped.toFixed(2)}
        </span>
        {lost && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#e5484d' }}>
            wager lost
          </span>
        )}
      </div>
      <div
        style={{
          position: 'relative',
          width: 130,
          height: 10,
          background: '#232220',
          borderRadius: 5,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: color,
            borderRadius: 5,
            transition: 'width 200ms cubic-bezier(0.33,1,0.68,1), background 200ms linear',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${breakEvenPct}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'rgba(255,255,255,.35)',
          }}
        />
      </div>
    </div>
  );
}
