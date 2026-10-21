/**
 * Slim in-game top bar: back to the picker, what you're playing, progress,
 * timer, the live wager pot (only while a bet is in play) and settings.
 * Setup (difficulty, piece count, Classic/Live, image) lives in the picker now,
 * so nothing here restarts the puzzle.
 */
import {
  G2,
  GAME_ACCENT,
  GAME_ACCENT_BORDER,
  GAME_ACCENT_SOFT,
  GAME_ACCENT_TEXT,
} from '../../game/constants';
import { ChevronLeftIcon, SettingsIcon } from '../ui/icons';

interface Props {
  title: string;
  metaLabel: string;
  solvedCount: number;
  totalPieces: number;
  timeLabel: string;
  timerHidden: boolean;
  onToggleTimer: () => void;
  wagerActive: boolean;
  wagerPot: number;
  wagerLost: boolean;
  isPhone: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
}

export function GameBar(p: Props) {
  const pct = p.totalPieces ? Math.round((p.solvedCount / p.totalPieces) * 100) : 0;

  const progress = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flex: p.isPhone ? '1 1 auto' : '0 1 300px',
        minWidth: 0,
      }}
    >
      <div
        role="progressbar"
        aria-label="Pieces placed"
        aria-valuemin={0}
        aria-valuemax={p.totalPieces}
        aria-valuenow={p.solvedCount}
        style={{
          flexGrow: 1,
          height: p.isPhone ? 5 : 6,
          borderRadius: 9999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          minWidth: 60,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: GAME_ACCENT,
            borderRadius: 9999,
            transition: 'width .3s ease',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: G2.fontMono,
          fontSize: p.isPhone ? 12 : 13,
          color: G2.textBody,
          whiteSpace: 'nowrap',
        }}
      >
        {p.solvedCount} / {p.totalPieces}
      </span>
    </div>
  );

  const timer = (
    <button
      type="button"
      onClick={p.onToggleTimer}
      title={p.timerHidden ? 'Show timer' : 'Hide timer'}
      aria-label={p.timerHidden ? 'Show timer' : 'Hide timer'}
      style={{
        minHeight: 36,
        minWidth: 44,
        padding: '0 6px',
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: G2.fontMono,
        fontSize: p.isPhone ? 12 : 15,
        color: p.timerHidden ? G2.textTertiary : G2.textBody,
      }}
    >
      {p.timerHidden ? '–:––' : p.timeLabel}
    </button>
  );

  const pot = p.wagerActive ? (
    <div
      title="Wager pot"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 9999,
        border: `1px solid ${p.wagerLost ? 'rgba(229,72,77,0.55)' : GAME_ACCENT_BORDER}`,
        background: p.wagerLost ? 'rgba(229,72,77,0.12)' : GAME_ACCENT_SOFT,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontFamily: G2.fontMono,
          fontWeight: 700,
          fontSize: p.isPhone ? 13 : 14,
          color: '#fff',
        }}
      >
        ${p.wagerPot.toFixed(2)}
      </span>
      {p.wagerLost ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#FCA5A5' }}>Wager lost</span>
      ) : (
        !p.isPhone && (
          <div
            style={{
              width: 64,
              height: 4,
              borderRadius: 9999,
              background: 'rgba(255,255,255,0.12)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, (p.wagerPot / 10) * 100))}%`,
                height: '100%',
                background: GAME_ACCENT_TEXT,
              }}
            />
          </div>
        )
      )}
    </div>
  ) : null;

  const backBtn = (
    <button
      type="button"
      onClick={p.onBack}
      aria-label="Back to puzzles"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        minWidth: 44,
        justifyContent: 'center',
        padding: p.isPhone ? 0 : '0 12px 0 6px',
        borderRadius: 8,
        border: 0,
        background: 'transparent',
        color: G2.textSecondary,
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      <ChevronLeftIcon size={20} />
      {!p.isPhone && 'Puzzles'}
    </button>
  );

  const settingsBtn = (
    <button
      type="button"
      onClick={p.onOpenSettings}
      aria-label="Puzzle settings"
      style={{
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        border: `1px solid ${G2.borderDefault}`,
        background: 'transparent',
        color: G2.textSecondary,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <SettingsIcon size={20} />
    </button>
  );

  if (p.isPhone) {
    return (
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 'max(8px, env(safe-area-inset-top, 0px)) 12px 8px',
          borderBottom: `1px solid ${G2.borderSubtle}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {backBtn}
          <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: G2.fontDisplay,
                fontWeight: 800,
                fontSize: 15,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {p.title}
            </span>
            <span style={{ fontFamily: G2.fontMono, fontSize: 11, color: G2.textTertiary }}>
              {p.metaLabel}
            </span>
          </div>
          {pot}
          {settingsBtn}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
          {progress}
          {timer}
        </div>
      </header>
    );
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 24px',
        minHeight: 64,
        borderBottom: `1px solid ${G2.borderSubtle}`,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: '1 1 0' }}>
        {backBtn}
        <span
          style={{
            fontFamily: G2.fontDisplay,
            fontWeight: 800,
            fontSize: 18,
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {p.title}
        </span>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 9999,
            border: `1px solid ${G2.borderDefault}`,
            fontFamily: G2.fontMono,
            fontSize: 11,
            color: G2.textSecondary,
            whiteSpace: 'nowrap',
          }}
        >
          {p.metaLabel}
        </span>
      </div>
      {progress}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flex: '1 1 0',
          justifyContent: 'flex-end',
        }}
      >
        {timer}
        {pot}
        {settingsBtn}
      </div>
    </header>
  );
}
