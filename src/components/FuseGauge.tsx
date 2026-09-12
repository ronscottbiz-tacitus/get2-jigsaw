import { BOARD_H, BOARD_OFFSET_X, BOARD_OFFSET_Y, BOARD_W, wagerColorFor, wagerUrgency } from '../game/constants';

interface Props {
  active: boolean;
  potNow: number;
  parSec: number;
  elapsedSec: number;
}

const PERIMETER = 2 * (BOARD_W + BOARD_H);

/** Point at arc-length `len` around the board's perimeter, starting at the
 * top-left corner and proceeding clockwise — matches the direction a native
 * <rect> path is drawn in, so the ember marker tracks the stroke exactly. */
function pointOnPerimeter(len: number): { x: number; y: number } {
  const l = ((len % PERIMETER) + PERIMETER) % PERIMETER;
  if (l <= BOARD_W) return { x: l, y: 0 };
  if (l <= BOARD_W + BOARD_H) return { x: BOARD_W, y: l - BOARD_W };
  if (l <= 2 * BOARD_W + BOARD_H) {
    return { x: BOARD_W - (l - BOARD_W - BOARD_H), y: BOARD_H };
  }
  return { x: 0, y: BOARD_H - (l - 2 * BOARD_W - BOARD_H) };
}

/**
 * Perimeter-tracing fuse overlay for wager mode. Sits on top of the board's
 * dashed outline and burns down (via strokeDasharray/strokeDashoffset) as
 * `elapsedSec` runs from 0 to `2 * parSec` — the same interval over which
 * `wagerPot` decays from $10 to $0 — so the visual and the payout hit zero
 * at the same instant with no separate math.
 */
export function FuseGauge({ active, potNow, parSec, elapsedSec }: Props) {
  if (!active) return null;

  const totalBurnSec = parSec * 2;
  const progress =
    totalBurnSec > 0 ? Math.min(1, Math.max(0, elapsedSec / totalBurnSec)) : 0;
  const urgency = wagerUrgency(potNow);
  const color = wagerColorFor(urgency);
  const burnedOut = progress >= 1;
  const tip = pointOnPerimeter(PERIMETER * (1 - progress));
  const glowBlur = 2 + urgency * 6;
  const strokeWidth = 3 + urgency * 2;

  return (
    <svg
      width={BOARD_W}
      height={BOARD_H}
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      style={{
        position: 'absolute',
        left: BOARD_OFFSET_X,
        top: BOARD_OFFSET_Y,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <filter id="fuse-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={glowBlur} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* unburnt wick trail, always full perimeter */}
      <rect
        x={0.5}
        y={0.5}
        width={BOARD_W - 1}
        height={BOARD_H - 1}
        rx={4}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={2}
      />

      {!burnedOut && (
        <>
          <rect
            x={0.5}
            y={0.5}
            width={BOARD_W - 1}
            height={BOARD_H - 1}
            rx={4}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={PERIMETER}
            strokeDashoffset={PERIMETER * progress}
            filter="url(#fuse-glow)"
            style={{
              transition: 'stroke-dashoffset 200ms linear, stroke 200ms linear',
            }}
          />
          <circle
            cx={tip.x}
            cy={tip.y}
            r={4 + urgency * 3}
            fill={color}
            filter="url(#fuse-glow)"
            style={{ transition: 'cx 200ms linear, cy 200ms linear, fill 200ms linear' }}
          >
            <animate attributeName="opacity" values="1;0.5;1" dur="0.35s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {burnedOut && (
        <rect
          x={0.5}
          y={0.5}
          width={BOARD_W - 1}
          height={BOARD_H - 1}
          rx={4}
          fill="none"
          stroke={color}
          strokeWidth={3}
          filter="url(#fuse-glow)"
        >
          <animate attributeName="opacity" values="0.85;0.2;0.85" dur="1.1s" repeatCount="indefinite" />
        </rect>
      )}
    </svg>
  );
}
