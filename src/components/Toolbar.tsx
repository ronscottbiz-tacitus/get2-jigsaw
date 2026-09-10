/**
 * The in-app control cluster above the board. Ported from the prototype's app
 * header + control rows: content-type toggle (Classic / Live), piece count,
 * difficulty, ghost preview, hint, new game, image/video pickers, board colour.
 */
import type { CSSProperties } from 'react';
import { BG_PRESETS, bgCssFor } from '../game/constants';
import { VIDEOS } from '../content/library';
import type { ContentType, Difficulty } from '../game/types';
import { WagerGauge } from './WagerGauge';

const ACTIVE_BG = 'rgba(63,174,125,.16)';
const ACTIVE = '#3fae7d';
const IDLE = '#6f6659';
const SEG_WRAP: CSSProperties = {
  display: 'flex',
  gap: 4,
  background: '#1a1613',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 9,
  padding: 4,
};

interface Props {
  difficultyLabel: string;
  rows: number;
  cols: number;
  difficulty: Difficulty;
  contentType: ContentType;
  videoSrc: string;
  bgColor: string;
  showGhost: boolean;
  timerHidden: boolean;
  timeLabel: string;
  solvedCount: number;
  totalPieces: number;
  currentImageLabel: string;
  hintAvailable: boolean;
  /** wager mode */
  wagerActive: boolean;
  wagerPot: number;
  wagerLost: boolean;
  wagerBalance: number;
  wagerStake: number;
  onToggleWager: () => void;
  onShowWelcome?: () => void;
  onSetContentType: (t: ContentType) => void;
  onSetPieceCount: (n: number) => void;
  onSetDifficulty: (d: Difficulty) => void;
  onToggleGhost: () => void;
  onToggleTimerHidden: () => void;
  onTriggerHint: () => void;
  onNewGame: () => void;
  onToggleLibrary: () => void;
  onSelectVideo: (src: string) => void;
  onSetBgColor: (hex: string) => void;
}

function ProBadge() {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.3,
        color: '#412402',
        background: '#efaa27',
        borderRadius: 4,
        padding: '1px 4px',
        marginLeft: 5,
        verticalAlign: 1,
      }}
    >
      PRO
    </span>
  );
}

function Seg<T extends string | number>({
  options,
  value,
  onChange,
  small,
}: {
  options: [T, string, boolean?][];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div style={{ ...SEG_WRAP, borderRadius: small ? 9 : 10 }}>
      {options.map(([key, label, premium]) => {
        const active = key === value;
        return (
          <button
            key={String(key)}
            type="button"
            onClick={() => onChange(key)}
            title={premium ? 'Premium feature — free during testing' : undefined}
            style={{
              padding: small ? '6px 12px' : '8px 20px',
              borderRadius: small ? 6 : 7,
              fontSize: small ? 11 : 13,
              cursor: 'pointer',
              background: active ? ACTIVE_BG : 'transparent',
              color: active ? ACTIVE : IDLE,
              fontWeight: active ? 700 : 400,
              border: 'none',
            }}
          >
            {label}
            {premium && <ProBadge />}
          </button>
        );
      })}
    </div>
  );
}

export function Toolbar(p: Props) {
  const isStatic = p.contentType !== 'video';
  const pill: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    borderRadius: 8,
    padding: '7px 12px',
    cursor: 'pointer',
    background: 'transparent',
  };

  return (
    <>
      <div
        style={{
          width: 1120,
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 4px 18px',
        }}
      >
        <button
          type="button"
          onClick={p.onShowWelcome}
          style={{
            color: '#a39a8d',
            textDecoration: 'none',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Overview
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Custom Puzzle</span>
          <span
            style={{
              fontSize: 11,
              color: '#6f6659',
              padding: '3px 9px',
              border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 12,
            }}
          >
            {p.difficultyLabel}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 13,
            color: '#a39a8d',
          }}
        >
          {p.wagerActive ? (
            <WagerGauge pot={p.wagerPot} lost={p.wagerLost} />
          ) : (
            !p.timerHidden && <span>{p.timeLabel}</span>
          )}
          <button
            type="button"
            onClick={p.onToggleTimerHidden}
            title={p.timerHidden ? 'Show timer' : 'Hide timer'}
            style={{
              cursor: 'pointer',
              display: 'flex',
              color: '#6f6659',
              background: 'transparent',
              border: 'none',
              padding: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 16 14" />
            </svg>
          </button>
          <span>
            {p.solvedCount} / {p.totalPieces}
          </span>
          <span
            title="Fake wager balance"
            style={{
              color:
                p.wagerBalance > 0
                  ? '#3fae7d'
                  : p.wagerBalance < 0
                    ? '#e5484d'
                    : '#a39a8d',
            }}
          >
            Bal ${p.wagerBalance.toFixed(2)}
          </span>
        </div>
      </div>

      <div
        style={{
          width: 1120,
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 14,
        }}
      >
        <Seg
          options={[
            ['static', 'Classic'],
            ['video', 'Live', true],
          ]}
          value={p.contentType}
          onChange={p.onSetContentType}
        />
      </div>

      <div
        style={{
          width: 1120,
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 16,
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <Seg
          small
          options={[
            [25, '25'],
            [48, '48'],
            [96, '96', true],
          ]}
          value={p.rows * p.cols}
          onChange={p.onSetPieceCount}
        />
        <Seg
          small
          options={[
            ['easy', 'Easy'],
            ['moderate', 'Moderate'],
            ['hard', 'Hard'],
          ]}
          value={p.difficulty}
          onChange={p.onSetDifficulty}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={p.onToggleWager}
            title={
              p.wagerActive
                ? 'Wager armed — the pot counts down once the puzzle breaks apart'
                : `Bet $${p.wagerStake}, matched to a $10 pot`
            }
            style={{
              ...pill,
              color: p.wagerActive ? ACTIVE : IDLE,
              border: `1px solid ${
                p.wagerActive ? 'rgba(63,174,125,.4)' : 'rgba(255,255,255,.12)'
              }`,
            }}
          >
            🎲 Wager ${p.wagerStake}
            <ProBadge />
          </button>

          <button
            type="button"
            onClick={p.onToggleGhost}
            style={{
              ...pill,
              color: p.showGhost ? ACTIVE : IDLE,
              border: `1px solid ${
                p.showGhost ? 'rgba(63,174,125,.4)' : 'rgba(255,255,255,.12)'
              }`,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Ghost preview
          </button>

          <button
            type="button"
            onClick={p.onTriggerHint}
            style={{
              ...pill,
              cursor: p.hintAvailable ? 'pointer' : 'default',
              color: p.hintAvailable ? '#3fae7d' : '#4a453e',
              border: `1px solid ${
                p.hintAvailable ? 'rgba(63,174,125,.4)' : 'rgba(255,255,255,.08)'
              }`,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-2.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
            </svg>
            Hint
          </button>

          <button
            type="button"
            onClick={p.onNewGame}
            style={{
              fontSize: 12,
              color: '#100e0c',
              background: '#3fae7d',
              borderRadius: 8,
              padding: '7px 14px',
              cursor: 'pointer',
              fontWeight: 700,
              border: 'none',
            }}
          >
            New game
          </button>

          {isStatic ? (
            <button
              type="button"
              onClick={p.onToggleLibrary}
              style={{
                ...pill,
                color: '#3fae7d',
                border: '1px solid rgba(63,174,125,.3)',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              Change image · {p.currentImageLabel}
            </button>
          ) : (
            <Seg
              small
              options={VIDEOS.map((v) => [v.src, v.name] as [string, string])}
              value={p.videoSrc}
              onChange={p.onSelectVideo}
            />
          )}

          <div
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              paddingLeft: 6,
              borderLeft: '1px solid rgba(255,255,255,.08)',
              marginLeft: 2,
            }}
          >
            {BG_PRESETS.map(({ hex }) => (
              <button
                key={hex}
                type="button"
                onClick={() => p.onSetBgColor(hex)}
                aria-label={`Board colour ${hex}`}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: bgCssFor(hex, 40),
                  boxShadow:
                    p.bgColor === hex
                      ? '0 0 0 2px #3fae7d'
                      : '0 0 0 1px rgba(255,255,255,.15)',
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
