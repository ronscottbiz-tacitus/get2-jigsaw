/**
 * Everything you set once and forget mid-puzzle: board surface, sound, timer,
 * buying hints with the wager balance, restarting, and the how-to-play line.
 * A panel under the top bar on desktop, a bottom sheet on phones.
 */
import { useEffect } from 'react';
import {
  BG_PRESETS,
  G2,
  GAME_ACCENT,
  GAME_ACCENT_TEXT,
  bgCssFor,
  formatMoney,
} from '../../game/constants';
import { CloseIcon } from '../ui/icons';

interface Props {
  isPhone: boolean;
  helpText: string;
  bgColor: string;
  onSetBgColor: (hex: string) => void;
  soundMuted: boolean;
  onToggleSound: () => void;
  timerHidden: boolean;
  onToggleTimer: () => void;
  hintPackSize: number;
  hintPackPrice: number;
  wagerBalance: number;
  onBuyHints: () => void;
  onRestart: () => void;
  onOverview?: () => void;
  onClose: () => void;
}

const label: React.CSSProperties = {
  fontFamily: G2.fontCondensed,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: G2.textTertiary,
};

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      {children}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  labelText,
}: {
  on: boolean;
  onClick: () => void;
  labelText: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={labelText}
      onClick={onClick}
      style={{
        width: 48,
        height: 28,
        borderRadius: 9999,
        border: 0,
        padding: 3,
        background: on ? GAME_ACCENT : 'rgba(255,255,255,0.16)',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background .15s',
        flexShrink: 0,
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', display: 'block' }} />
    </button>
  );
}

const textBtn: React.CSSProperties = {
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 10,
  border: `1px solid ${G2.borderDefault}`,
  background: 'transparent',
  color: G2.textBody,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

export function SettingsMenu(p: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  const canBuy = p.wagerBalance >= p.hintPackPrice;

  return (
    <div
      onClick={p.onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: p.isPhone ? 'rgba(0,0,0,0.55)' : 'transparent',
        display: 'flex',
        alignItems: p.isPhone ? 'flex-end' : 'flex-start',
        justifyContent: p.isPhone ? 'stretch' : 'flex-end',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Puzzle settings"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: p.isPhone ? '100%' : 340,
          margin: p.isPhone ? 0 : '68px 24px 0 0',
          boxSizing: 'border-box',
          padding: p.isPhone ? '20px 20px max(24px, env(safe-area-inset-bottom, 0px))' : 22,
          borderRadius: p.isPhone ? '18px 18px 0 0' : 14,
          background: G2.bgPanel,
          border: `1px solid ${G2.borderDefault}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          color: G2.textBody,
          fontFamily: G2.fontBody,
        }}
      >
        <Row>
          <span style={{ fontFamily: G2.fontDisplay, fontWeight: 800, fontSize: 16, color: '#fff' }}>
            Settings
          </span>
          <button
            type="button"
            onClick={p.onClose}
            aria-label="Close settings"
            style={{
              width: 44,
              height: 44,
              border: 0,
              background: 'transparent',
              color: G2.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: -10,
            }}
          >
            <CloseIcon size={20} />
          </button>
        </Row>

        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: G2.textSecondary }}>
          {p.helpText}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={label}>Board</span>
          <div style={{ display: 'flex', gap: 10 }}>
            {BG_PRESETS.map((b) => {
              const on = b.hex === p.bgColor;
              return (
                <button
                  key={b.hex}
                  type="button"
                  onClick={() => p.onSetBgColor(b.hex)}
                  aria-label={`Board surface ${b.hex}`}
                  aria-pressed={on}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: `1px solid ${G2.borderDefault}`,
                    background: b.css ?? bgCssFor(b.hex, 60),
                    boxShadow: on ? `0 0 0 2px ${G2.bgPanel}, 0 0 0 4px ${GAME_ACCENT}` : 'none',
                    cursor: 'pointer',
                  }}
                />
              );
            })}
          </div>
        </div>

        <Row>
          <span style={{ fontSize: 14 }}>Sound</span>
          <Toggle on={!p.soundMuted} onClick={p.onToggleSound} labelText="Sound" />
        </Row>
        <Row>
          <span style={{ fontSize: 14 }}>Show timer</span>
          <Toggle on={!p.timerHidden} onClick={p.onToggleTimer} labelText="Show timer" />
        </Row>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 14,
            borderRadius: 10,
            background: G2.bgPanelAlt,
            border: `1px solid ${G2.borderSubtle}`,
          }}
        >
          <Row>
            <span style={{ fontSize: 14 }}>
              {p.hintPackSize} more hints · ${p.hintPackPrice.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={canBuy ? p.onBuyHints : undefined}
              aria-disabled={!canBuy || undefined}
              style={{
                ...textBtn,
                minHeight: 36,
                color: canBuy ? GAME_ACCENT_TEXT : G2.textMuted,
                cursor: canBuy ? 'pointer' : 'default',
              }}
            >
              Buy
            </button>
          </Row>
          <span style={{ fontFamily: G2.fontMono, fontSize: 11, color: G2.textTertiary }}>
            Wager balance {formatMoney(p.wagerBalance)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={p.onRestart} style={{ ...textBtn, flex: '1 1 auto' }}>
            Restart puzzle
          </button>
          {p.onOverview && (
            <button type="button" onClick={p.onOverview} style={{ ...textBtn, flex: '1 1 auto' }}>
              About Get2Puzzle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
