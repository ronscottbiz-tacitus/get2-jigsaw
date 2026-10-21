/**
 * The in-play tools, in one floating pill under the board: Rotate (Moderate
 * only — Hard spins via the on-piece handle, Easy doesn't rotate), Hint,
 * Ghost preview and Sound. On phones Sound moves into settings and a "More"
 * button opens them, so every button stays thumb-sized.
 */
import type { CSSProperties, ReactNode } from 'react';
import { G2, GAME_ACCENT_STRONG, GAME_ACCENT_SOFT } from '../../game/constants';
import type { Difficulty } from '../../game/types';
import {
  BulbIcon,
  EyeIcon,
  MoreIcon,
  RotateIcon,
  VolumeIcon,
  VolumeOffIcon,
} from '../ui/icons';

interface Props {
  difficulty: Difficulty;
  canRotate: boolean;
  onRotate: () => void;
  hintsRemaining: number;
  hintAvailable: boolean;
  onHint: () => void;
  showGhost: boolean;
  onToggleGhost: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
  isPhone: boolean;
  onOpenSettings: () => void;
}

function DockButton({
  label,
  ariaLabel,
  icon,
  onClick,
  disabled,
  pressed,
  primary,
  isPhone,
  grow = 1,
  title,
}: {
  label?: string;
  ariaLabel?: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  primary?: boolean;
  isPhone: boolean;
  grow?: number;
  title?: string;
}) {
  const style: CSSProperties = {
    minHeight: isPhone ? 52 : 48,
    minWidth: label ? 0 : isPhone ? 52 : 48,
    padding: label ? (isPhone ? '0 10px' : '0 16px') : 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: isPhone ? 12 : 11,
    border: isPhone && !primary ? `1px solid ${G2.borderDefault}` : 0,
    background: primary
      ? disabled
        ? 'rgba(124,58,237,0.35)'
        : GAME_ACCENT_STRONG
      : pressed
        ? 'rgba(124,58,237,0.28)'
        : 'transparent',
    color: disabled && !primary ? G2.textMuted : '#fff',
    fontSize: isPhone ? 13 : 14,
    fontWeight: primary ? 700 : 600,
    cursor: disabled ? 'default' : 'pointer',
    whiteSpace: 'nowrap',
    flex: isPhone ? `${grow} 1 0` : '0 0 auto',
    opacity: disabled && primary ? 0.7 : 1,
  };
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      title={title}
      style={style}
    >
      {(!isPhone || primary || !label) && icon}
      {label}
    </button>
  );
}

export function Dock(p: Props) {
  const showRotate = p.difficulty === 'moderate';
  const hintDisabled = !p.hintAvailable || p.hintsRemaining <= 0;

  const buttons = (
    <>
      {showRotate && (
        <DockButton
          primary
          isPhone={p.isPhone}
          grow={1.4}
          label="Rotate"
          icon={<RotateIcon />}
          onClick={p.onRotate}
          disabled={!p.canRotate}
          title={p.canRotate ? 'Turn the selected piece 90°' : 'Select a piece first'}
        />
      )}
      <DockButton
        isPhone={p.isPhone}
        label={`Hint · ${p.hintsRemaining}`}
        icon={<BulbIcon />}
        onClick={p.onHint}
        disabled={hintDisabled}
        title={p.hintsRemaining <= 0 ? 'Out of hints — buy more in settings' : 'Show where a piece goes'}
      />
      <DockButton
        isPhone={p.isPhone}
        label="Ghost"
        icon={<EyeIcon />}
        onClick={p.onToggleGhost}
        pressed={p.showGhost}
        title="Faint preview of the finished picture"
      />
      {p.isPhone ? (
        <DockButton
          isPhone
          grow={0}
          ariaLabel="More options"
          icon={<MoreIcon size={20} />}
          onClick={p.onOpenSettings}
        />
      ) : (
        <DockButton
          isPhone={false}
          ariaLabel={p.soundMuted ? 'Sound off' : 'Sound on'}
          title={p.soundMuted ? 'Sound off' : 'Sound on'}
          icon={p.soundMuted ? <VolumeOffIcon /> : <VolumeIcon />}
          onClick={p.onToggleSound}
          pressed={p.soundMuted}
        />
      )}
    </>
  );

  if (p.isPhone) {
    return (
      <nav
        aria-label="Puzzle tools"
        style={{
          display: 'flex',
          gap: 6,
          padding: '10px 16px max(16px, env(safe-area-inset-bottom, 0px))',
          flexShrink: 0,
        }}
      >
        {buttons}
      </nav>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 16px 20px', flexShrink: 0 }}>
      <nav
        aria-label="Puzzle tools"
        style={{
          display: 'flex',
          gap: 6,
          padding: 6,
          borderRadius: 16,
          background: 'rgba(12,13,16,0.94)',
          border: `1px solid ${G2.borderDefault}`,
          boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px ${GAME_ACCENT_SOFT} inset`,
        }}
      >
        {buttons}
      </nav>
    </div>
  );
}
