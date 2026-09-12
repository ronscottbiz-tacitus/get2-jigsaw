/**
 * The in-app control cluster above the board. Ported from the prototype's app
 * header + control rows: content-type toggle (Classic / Live), piece count,
 * difficulty, ghost preview, hint, new game, image/video pickers, board colour.
 *
 * Below `MOBILE_BREAKPOINT` this renders a compact header (new game, hint,
 * difficulty, piece count) plus a bottom-sheet drawer for the secondary
 * controls (content type, ghost preview, sound, wager, image/video picker,
 * board colour) instead of the desktop's single wide row — see
 * `MobileToolbar` below.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { BG_PRESETS, MOBILE_BREAKPOINT, bgCssFor } from '../game/constants';
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
  soundMuted: boolean;
  timeLabel: string;
  solvedCount: number;
  totalPieces: number;
  currentImageLabel: string;
  hintAvailable: boolean;
  hintsRemaining: number;
  hintPackSize: number;
  hintPackPrice: number;
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
  onToggleSound: () => void;
  onTriggerHint: () => void;
  onBuyHints: () => void;
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
  stretch,
}: {
  options: [T, string, boolean?][];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
  /** Buttons split the row evenly and grow to a touch-friendly height —
   * used by the mobile compact header instead of desktop's content-hugging
   * sizing. */
  stretch?: boolean;
}) {
  return (
    <div style={{ ...SEG_WRAP, borderRadius: small ? 9 : 10, width: stretch ? '100%' : undefined }}>
      {options.map(([key, label, premium]) => {
        const active = key === value;
        return (
          <button
            key={String(key)}
            type="button"
            onClick={() => onChange(key)}
            title={premium ? 'Premium feature — free during testing' : undefined}
            style={{
              flex: stretch ? 1 : undefined,
              padding: stretch ? '11px 6px' : small ? '6px 12px' : '8px 20px',
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

/** Live-tracks whether the viewport is at or below `MOBILE_BREAKPOINT`. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    onChange(mq);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export function Toolbar(p: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileToolbar {...p} /> : <DesktopToolbar {...p} />;
}

function DesktopToolbar(p: Props) {
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
            ['video', 'Live'],
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
            [96, '96'],
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
            onClick={p.onToggleSound}
            title={p.soundMuted ? 'Sound off' : 'Sound on'}
            style={{
              ...pill,
              color: p.soundMuted ? ACTIVE : IDLE,
              border: `1px solid ${
                p.soundMuted ? 'rgba(63,174,125,.4)' : 'rgba(255,255,255,.12)'
              }`,
            }}
          >
            {p.soundMuted ? (
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
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
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
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
            {p.soundMuted ? 'Muted' : 'Sound'}
          </button>

          <button
            type="button"
            onClick={p.onTriggerHint}
            disabled={!p.hintAvailable || p.hintsRemaining <= 0}
            title={p.hintsRemaining <= 0 ? 'Out of hints for this puzzle' : undefined}
            style={{
              ...pill,
              cursor:
                p.hintAvailable && p.hintsRemaining > 0 ? 'pointer' : 'default',
              color:
                p.hintAvailable && p.hintsRemaining > 0 ? '#3fae7d' : '#4a453e',
              border: `1px solid ${
                p.hintAvailable && p.hintsRemaining > 0
                  ? 'rgba(63,174,125,.4)'
                  : 'rgba(255,255,255,.08)'
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
            Hints: {p.hintsRemaining}
          </button>

          {p.wagerBalance > 0 && (
            <button
              type="button"
              onClick={p.onBuyHints}
              disabled={p.wagerBalance < p.hintPackPrice}
              title={`Buy ${p.hintPackSize} more hints for $${p.hintPackPrice.toFixed(
                2,
              )} from your wager balance`}
              style={{
                ...pill,
                cursor:
                  p.wagerBalance >= p.hintPackPrice ? 'pointer' : 'default',
                color:
                  p.wagerBalance >= p.hintPackPrice ? '#efaa27' : '#4a453e',
                border: `1px solid ${
                  p.wagerBalance >= p.hintPackPrice
                    ? 'rgba(239,170,39,.4)'
                    : 'rgba(255,255,255,.08)'
                }`,
              }}
            >
              +{p.hintPackSize} hints · ${p.hintPackPrice.toFixed(2)}
            </button>
          )}

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
            {BG_PRESETS.map(({ hex, css }) => (
              <button
                key={hex}
                type="button"
                onClick={() => p.onSetBgColor(hex)}
                aria-label={`Board colour ${hex}`}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: css ?? bgCssFor(hex, 40),
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

const touchIconBtn: CSSProperties = {
  width: 40,
  height: 40,
  minWidth: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#a39a8d',
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  flexShrink: 0,
};

function MobileToolbar(p: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isStatic = p.contentType !== 'video';

  const mobilePill: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    borderRadius: 8,
    padding: '11px 12px',
    cursor: 'pointer',
    background: 'transparent',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ width: '100%', paddingBottom: 12 }}>
      {/* compact header: always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={p.onShowWelcome} style={touchIconBtn} aria-label="Overview">
          <svg
            width="16"
            height="16"
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
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            flex: 1,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Custom Puzzle
        </span>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          style={{
            ...touchIconBtn,
            color: ACTIVE,
            border: '1px solid rgba(63,174,125,.35)',
          }}
          aria-label="More options"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </div>

      {/* status strip: time/wager, solved count, balance */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 12,
          color: '#a39a8d',
          padding: '6px 0 10px',
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
            padding: 4,
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
              p.wagerBalance > 0 ? '#3fae7d' : p.wagerBalance < 0 ? '#e5484d' : '#a39a8d',
          }}
        >
          Bal ${p.wagerBalance.toFixed(2)}
        </span>
      </div>

      {/* essential controls: difficulty + piece count, full-width for easy thumbing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
        <Seg
          stretch
          options={[
            ['easy', 'Easy'],
            ['moderate', 'Moderate'],
            ['hard', 'Hard'],
          ]}
          value={p.difficulty}
          onChange={p.onSetDifficulty}
        />
        <Seg
          stretch
          options={[
            [25, '25 pcs'],
            [48, '48 pcs'],
            [96, '96 pcs'],
          ]}
          value={p.rows * p.cols}
          onChange={p.onSetPieceCount}
        />
      </div>

      {/* essential actions: new game + hints — never tucked into the drawer */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={p.onNewGame}
          style={{
            fontSize: 13,
            color: '#100e0c',
            background: '#3fae7d',
            borderRadius: 8,
            padding: '11px 16px',
            cursor: 'pointer',
            fontWeight: 700,
            border: 'none',
            flex: '1 1 auto',
          }}
        >
          New game
        </button>

        <button
          type="button"
          onClick={p.onTriggerHint}
          disabled={!p.hintAvailable || p.hintsRemaining <= 0}
          title={p.hintsRemaining <= 0 ? 'Out of hints for this puzzle' : undefined}
          style={{
            ...mobilePill,
            flex: '1 1 auto',
            justifyContent: 'center',
            cursor: p.hintAvailable && p.hintsRemaining > 0 ? 'pointer' : 'default',
            color: p.hintAvailable && p.hintsRemaining > 0 ? '#3fae7d' : '#4a453e',
            border: `1px solid ${
              p.hintAvailable && p.hintsRemaining > 0
                ? 'rgba(63,174,125,.4)'
                : 'rgba(255,255,255,.08)'
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
          Hints: {p.hintsRemaining}
        </button>

        {p.wagerBalance > 0 && (
          <button
            type="button"
            onClick={p.onBuyHints}
            disabled={p.wagerBalance < p.hintPackPrice}
            title={`Buy ${p.hintPackSize} more hints for $${p.hintPackPrice.toFixed(
              2,
            )} from your wager balance`}
            style={{
              ...mobilePill,
              flex: '1 1 auto',
              justifyContent: 'center',
              cursor: p.wagerBalance >= p.hintPackPrice ? 'pointer' : 'default',
              color: p.wagerBalance >= p.hintPackPrice ? '#efaa27' : '#4a453e',
              border: `1px solid ${
                p.wagerBalance >= p.hintPackPrice
                  ? 'rgba(239,170,39,.4)'
                  : 'rgba(255,255,255,.08)'
              }`,
            }}
          >
            +{p.hintPackSize} · ${p.hintPackPrice.toFixed(2)}
          </button>
        )}
      </div>

      {drawerOpen && (
        <MobileDrawer onClose={() => setDrawerOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <DrawerSection label="Content">
              <Seg
                stretch
                options={[
                  ['static', 'Classic'],
                  ['video', 'Live'],
                ]}
                value={p.contentType}
                onChange={p.onSetContentType}
              />
            </DrawerSection>

            {isStatic ? (
              <DrawerSection label="Image">
                <button
                  type="button"
                  onClick={p.onToggleLibrary}
                  style={{
                    ...mobilePill,
                    width: '100%',
                    justifyContent: 'center',
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
              </DrawerSection>
            ) : (
              <DrawerSection label="Video">
                <Seg
                  stretch
                  options={VIDEOS.map((v) => [v.src, v.name] as [string, string])}
                  value={p.videoSrc}
                  onChange={p.onSelectVideo}
                />
              </DrawerSection>
            )}

            <DrawerSection label="Board colour">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {BG_PRESETS.map(({ hex, css }) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => p.onSetBgColor(hex)}
                    aria-label={`Board colour ${hex}`}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: css ?? bgCssFor(hex, 40),
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
            </DrawerSection>

            <DrawerSection label="Options">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={p.onToggleGhost}
                  style={{
                    ...mobilePill,
                    flex: '1 1 auto',
                    justifyContent: 'center',
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
                  onClick={p.onToggleSound}
                  title={p.soundMuted ? 'Sound off' : 'Sound on'}
                  style={{
                    ...mobilePill,
                    flex: '1 1 auto',
                    justifyContent: 'center',
                    color: p.soundMuted ? ACTIVE : IDLE,
                    border: `1px solid ${
                      p.soundMuted ? 'rgba(63,174,125,.4)' : 'rgba(255,255,255,.12)'
                    }`,
                  }}
                >
                  {p.soundMuted ? (
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
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
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
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  )}
                  {p.soundMuted ? 'Muted' : 'Sound'}
                </button>

                <button
                  type="button"
                  onClick={p.onToggleWager}
                  title={
                    p.wagerActive
                      ? 'Wager armed — the pot counts down once the puzzle breaks apart'
                      : `Bet $${p.wagerStake}, matched to a $10 pot`
                  }
                  style={{
                    ...mobilePill,
                    flex: '1 1 auto',
                    justifyContent: 'center',
                    color: p.wagerActive ? ACTIVE : IDLE,
                    border: `1px solid ${
                      p.wagerActive ? 'rgba(63,174,125,.4)' : 'rgba(255,255,255,.12)'
                    }`,
                  }}
                >
                  🎲 Wager ${p.wagerStake}
                </button>
              </div>
            </DrawerSection>
          </div>
        </MobileDrawer>
      )}
    </div>
  );
}

function DrawerSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: '#6f6659',
          paddingBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function MobileDrawer({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.55)',
          animation: 'puzzleFadeIn .15s ease-out',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '80vh',
          overflowY: 'auto',
          background: '#1a1613',
          borderTop: '1px solid rgba(255,255,255,.08)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: '10px 16px 24px',
          boxShadow: '0 -12px 32px rgba(0,0,0,.5)',
          animation: 'sheetSlideUp .18s cubic-bezier(.22,1,.36,1)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,.18)',
            margin: '0 auto 14px',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>More options</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ ...touchIconBtn, width: 32, height: 32, minWidth: 32 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
