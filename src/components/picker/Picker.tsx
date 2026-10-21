/**
 * "Pick a puzzle" — where every round starts. Classic / Live tabs, category
 * filters, the library as a grid (with your best time on anything you've
 * solved at the current setup), and a setup panel: difficulty, piece count and
 * the optional $5 wager, decided BEFORE the clock starts. A saved in-progress
 * puzzle shows as a "Continue" card on top.
 *
 * Desktop: grid + sticky setup panel side by side. Phone: grid, then the setup
 * panel, with a sticky Start bar pinned to the bottom of the screen.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_PIECE_COUNT,
  DEFAULT_PIECE_COUNT_PHONE,
  G2,
  GAME_ACCENT,
  GAME_ACCENT_BORDER,
  GAME_ACCENT_SOFT,
  GAME_ACCENT_STRONG,
  MOBILE_BREAKPOINT,
  WAGER_STAKE,
  formatMoney,
  isPhoneViewport,
  wagerParSeconds,
} from '../../game/constants';
import type { ContentType, Difficulty, PuzzleConfig } from '../../game/types';
import {
  CATEGORIES,
  IMAGES,
  VIDEOS,
  type Category,
} from '../../content/library';
import {
  bestTimeForConfig,
  getLastSetup,
  getWagerBalance,
  setLastSetup,
} from '../../game/persistence';
import { LiveVideo } from '../ui/LiveVideo';

export interface ResumeInfo {
  title: string;
  summary: string;
  thumb: string;
}

interface Props {
  /** Preselect this item (e.g. a tile tapped on the overview page). */
  initial?: { contentType: ContentType; src: string };
  resume: ResumeInfo | null;
  onResume: () => void;
  onStart: (config: PuzzleConfig) => void;
  onOverview: () => void;
}

interface Tile {
  id: string;
  contentType: ContentType;
  src: string;
  thumb: string;
  name: string;
  category: string;
}

const CATEGORY_SHORT: Record<Category, string> = {
  'Landscapes / Nature': 'Landscapes',
  'Animals / Wildlife': 'Animals',
  'Architecture / Cityscapes': 'Cities',
  'Space / Cosmic': 'Space',
  'Abstract / Pattern Art': 'Abstract',
  'Florals / Botanical': 'Florals',
};

const CLASSIC_TILES: Tile[] = IMAGES.map((i) => ({
  id: `img-${i.key}`,
  contentType: 'static',
  src: i.full,
  thumb: i.thumb,
  name: i.name,
  category: i.category,
}));
const LIVE_TILES: Tile[] = VIDEOS.map((v) => ({
  id: `vid-${v.key}`,
  contentType: 'video',
  src: v.src,
  thumb: v.poster,
  name: v.name,
  category: 'Live',
}));

const TIERS: { id: Difficulty; label: string; sub: string }[] = [
  { id: 'easy', label: 'Easy', sub: 'No rotation' },
  { id: 'moderate', label: 'Moderate', sub: '90° turns' },
  { id: 'hard', label: 'Hard', sub: 'Free spin' },
];
const COUNTS = [25, 48, 96];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function useIsPhone() {
  const [phone, setPhone] = useState(isPhoneViewport);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const on = (e: MediaQueryListEvent) => setPhone(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

const sectionLabel: CSSProperties = {
  fontFamily: G2.fontCondensed,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: G2.textTertiary,
};

function optionStyle(on: boolean): CSSProperties {
  return {
    borderRadius: 10,
    cursor: 'pointer',
    background: on ? 'rgba(124,58,237,0.22)' : 'transparent',
    border: `1px solid ${on ? GAME_ACCENT : G2.borderDefault}`,
    color: '#fff',
  };
}

export function Picker({ initial, resume, onResume, onStart, onOverview }: Props) {
  const isPhone = useIsPhone();
  const last = useMemo(getLastSetup, []);

  const initialTile =
    (initial &&
      [...CLASSIC_TILES, ...LIVE_TILES].find(
        (t) => t.contentType === initial.contentType && t.src === initial.src,
      )) ||
    CLASSIC_TILES[0];

  const [mode, setMode] = useState<ContentType>(initialTile.contentType);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [selectedId, setSelectedId] = useState(initialTile.id);
  const [difficulty, setDifficulty] = useState<Difficulty>(last?.difficulty ?? DEFAULT_DIFFICULTY);
  const [pieceCount, setPieceCount] = useState<number>(
    last?.pieceCount ?? (isPhoneViewport() ? DEFAULT_PIECE_COUNT_PHONE : DEFAULT_PIECE_COUNT),
  );
  const [wager, setWager] = useState(false);
  const balance = useMemo(getWagerBalance, []);

  const tiles =
    mode === 'video'
      ? LIVE_TILES
      : CLASSIC_TILES.filter((t) => category === 'all' || t.category === category);
  const selected =
    [...CLASSIC_TILES, ...LIVE_TILES].find((t) => t.id === selectedId) ?? CLASSIC_TILES[0];
  const par = wagerParSeconds(pieceCount, difficulty);
  const selectedBest = bestTimeForConfig(selected.contentType, selected.src, difficulty, pieceCount);

  const switchMode = (m: ContentType) => {
    setMode(m);
    if (selected.contentType !== m) {
      setSelectedId((m === 'video' ? LIVE_TILES : CLASSIC_TILES)[0].id);
    }
  };

  const start = () => {
    setLastSetup({ difficulty, pieceCount });
    onStart({
      contentType: selected.contentType,
      src: selected.src,
      difficulty,
      pieceCount,
      wager,
    });
  };

  const header = (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: isPhone
          ? 'max(14px, env(safe-area-inset-top, 0px)) 16px 14px'
          : '18px 32px',
        borderBottom: `1px solid ${G2.borderSubtle}`,
      }}
    >
      <button
        type="button"
        onClick={onOverview}
        aria-label="Get2Puzzle overview"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          border: 0,
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        <img
          src="/uploads/get2-logo.png"
          alt="Get2"
          style={{ height: isPhone ? 30 : 36, width: 'auto', display: 'block' }}
        />
        <span
          style={{
            fontFamily: G2.fontCondensed,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: '#A78BFA',
          }}
        >
          Puzzle
        </span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {balance !== 0 && (
          <span style={{ fontFamily: G2.fontMono, fontSize: 12, color: G2.textTertiary }}>
            {isPhone ? '' : 'Wager balance '}
            {formatMoney(balance)}
          </span>
        )}
        {!isPhone && (
          <button
            type="button"
            onClick={onOverview}
            style={{
              border: 0,
              background: 'transparent',
              color: G2.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            About
          </button>
        )}
      </div>
    </header>
  );

  const resumeCard = resume && (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 12,
        borderRadius: 14,
        background: G2.bgPanel,
        border: `1px solid ${GAME_ACCENT_BORDER}`,
        flexWrap: 'wrap',
      }}
    >
      <img
        src={resume.thumb}
        alt=""
        style={{ width: 88, height: 60, objectFit: 'cover', borderRadius: 8, display: 'block' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 160px', minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Continue {resume.title}</span>
        <span style={{ fontFamily: G2.fontMono, fontSize: 12, color: G2.textTertiary }}>
          {resume.summary}
        </span>
      </div>
      <button
        type="button"
        onClick={onResume}
        style={{
          minHeight: 44,
          padding: '0 20px',
          borderRadius: 9999,
          border: 0,
          background: GAME_ACCENT_STRONG,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          flex: isPhone ? '1 1 100%' : '0 0 auto',
        }}
      >
        Continue
      </button>
    </div>
  );

  const tabs = (
    <div
      role="tablist"
      aria-label="Puzzle type"
      style={{
        display: 'flex',
        padding: 4,
        gap: 4,
        borderRadius: 9999,
        border: `1px solid ${G2.borderDefault}`,
        background: G2.bgPanel,
        alignSelf: isPhone ? 'stretch' : 'auto',
      }}
    >
      {(
        [
          ['static', 'Classic'],
          ['video', 'Live'],
        ] as const
      ).map(([id, label]) => {
        const on = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => switchMode(id)}
            style={{
              minHeight: 40,
              padding: '0 22px',
              flex: isPhone ? '1 1 0' : '0 0 auto',
              border: 0,
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              background: on ? GAME_ACCENT_STRONG : 'transparent',
              color: on ? '#fff' : G2.textSecondary,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const chips =
    mode === 'static' ? (
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: isPhone ? 'nowrap' : 'wrap',
          overflowX: isPhone ? 'auto' : 'visible',
          margin: isPhone ? '0 -16px' : 0,
          padding: isPhone ? '0 16px 2px' : 0,
        }}
      >
        {(['all', ...CATEGORIES] as const).map((c) => {
          const on = category === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => setCategory(c)}
              style={{
                minHeight: 36,
                padding: '0 14px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: on ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: on ? 'rgba(139,92,246,0.16)' : 'transparent',
                color: on ? '#C4B5FD' : G2.textSecondary,
                border: `1px solid ${on ? GAME_ACCENT_BORDER : G2.borderDefault}`,
              }}
            >
              {c === 'all' ? 'All' : CATEGORY_SHORT[c]}
            </button>
          );
        })}
      </div>
    ) : (
      <p style={{ margin: 0, fontSize: 13.5, color: G2.textSecondary }}>
        Every piece is a sliver of a looping video — the picture keeps moving while you solve it.
      </p>
    );

  const grid = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isPhone
          ? 'repeat(2, minmax(0, 1fr))'
          : 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: isPhone ? 12 : 18,
      }}
    >
      {tiles.map((t) => {
        const on = t.id === selected.id;
        const best = bestTimeForConfig(t.contentType, t.src, difficulty, pieceCount);
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => setSelectedId(t.id)}
            onDoubleClick={() => {
              setSelectedId(t.id);
              if (!isPhone) setTimeout(start, 0);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 0,
              textAlign: 'left',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            <span
              style={{
                position: 'relative',
                display: 'block',
                width: '100%',
                aspectRatio: '7 / 5',
                borderRadius: 12,
                overflow: 'hidden',
                boxSizing: 'border-box',
                background: '#15161a',
              }}
            >
              {t.contentType === 'video' ? (
                <LiveVideo src={t.src} poster={t.thumb} style={{ width: '100%', height: '100%' }} />
              ) : (
                <img
                  src={t.thumb}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              {/* selection ring sits above the image/video */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 12,
                  boxShadow: on ? `inset 0 0 0 2px ${GAME_ACCENT}` : 'none',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
              {t.contentType === 'video' && (
                <span
                  style={{
                    position: 'absolute',
                    zIndex: 2,
                    top: 8,
                    left: 8,
                    padding: '3px 8px',
                    borderRadius: 9999,
                    background: 'rgba(5,5,6,0.72)',
                    fontFamily: G2.fontMono,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: '#fff',
                  }}
                >
                  ● LIVE
                </span>
              )}
              {best != null && (
                <span
                  style={{
                    position: 'absolute',
                    zIndex: 2,
                    bottom: 8,
                    right: 8,
                    padding: '3px 8px',
                    borderRadius: 9999,
                    background: 'rgba(5,5,6,0.72)',
                    fontFamily: G2.fontMono,
                    fontSize: 10.5,
                    color: G2.textBody,
                  }}
                >
                  Best {fmt(best)}
                </span>
              )}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontFamily: G2.fontCondensed,
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: G2.textTertiary,
                }}
              >
                {t.contentType === 'video' ? 'Live' : CATEGORY_SHORT[t.category as Category]}
              </span>
              <span style={{ fontSize: isPhone ? 14 : 15, fontWeight: 600, color: '#fff' }}>
                {t.name}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const startButton = (
    <button
      type="button"
      onClick={start}
      style={{
        minHeight: 52,
        width: '100%',
        borderRadius: 9999,
        border: 0,
        background: G2.blue,
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      Start puzzle
    </button>
  );

  const setup = (
    <aside
      aria-label="Puzzle setup"
      style={{
        boxSizing: 'border-box',
        padding: isPhone ? 18 : 24,
        borderRadius: 14,
        background: G2.bgPanel,
        border: `1px solid ${G2.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        ...(isPhone
          ? {}
          : {
              position: 'sticky' as const,
              top: 24,
              flex: '0 0 360px',
              alignSelf: 'flex-start',
            }),
      }}
    >
      {!isPhone &&
        (selected.contentType === 'video' ? (
          <LiveVideo
            src={selected.src}
            poster={selected.thumb}
            style={{ width: '100%', aspectRatio: '7 / 5', borderRadius: 10 }}
          />
        ) : (
          <img
            src={selected.thumb}
            alt={selected.name}
            style={{ width: '100%', aspectRatio: '7 / 5', objectFit: 'cover', borderRadius: 10, display: 'block' }}
          />
        ))}
      {!isPhone && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: G2.fontDisplay, fontWeight: 800, fontSize: 22, color: '#fff' }}>
            {selected.name}
          </span>
          <span style={{ fontFamily: G2.fontMono, fontSize: 12, color: G2.textTertiary }}>
            {selectedBest != null ? `Your best here: ${fmt(selectedBest)}` : 'Not solved at this setup yet'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={sectionLabel}>Difficulty</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={difficulty === t.id}
              onClick={() => setDifficulty(t.id)}
              style={{
                ...optionStyle(difficulty === t.id),
                minHeight: 60,
                padding: '8px 6px',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</span>
              <span style={{ fontSize: 11, color: G2.textSecondary }}>{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={sectionLabel}>Pieces</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={pieceCount === n}
              onClick={() => setPieceCount(n)}
              style={{ ...optionStyle(pieceCount === n), minHeight: 44, fontSize: 14, fontWeight: 700 }}
            >
              {n}
            </button>
          ))}
        </div>
        {isPhone && pieceCount === 96 && (
          <span style={{ fontSize: 12, color: G2.textTertiary }}>
            96 pieces get very small on a phone — 25 or 48 plays best here.
          </span>
        )}
      </div>

      <label
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          padding: 14,
          borderRadius: 10,
          border: `1px solid ${wager ? GAME_ACCENT : G2.borderDefault}`,
          background: wager ? GAME_ACCENT_SOFT : 'transparent',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={wager}
          onChange={() => setWager((w) => !w)}
          style={{ width: 20, height: 20, margin: '2px 0 0', accentColor: GAME_ACCENT_STRONG, flexShrink: 0 }}
        />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            Wager ${WAGER_STAKE} on this one
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: G2.textSecondary }}>
            Your ${WAGER_STAKE} is matched into a $10 pot that shrinks as you play. Beat {fmt(par)} to
            come out ahead. Play money only.
          </span>
        </span>
      </label>

      {!isPhone && startButton}
    </aside>
  );

  if (isPhone) {
    return (
      <div style={{ minHeight: '100dvh', background: G2.bgPage, color: G2.textBody, fontFamily: G2.fontBody }}>
        {header}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '18px 16px 120px' }}>
          {resumeCard}
          <h1 style={{ margin: 0, fontFamily: G2.fontDisplay, fontWeight: 800, fontSize: 26, color: '#fff' }}>
            Pick a puzzle
          </h1>
          {tabs}
          {chips}
          {grid}
          {setup}
        </main>
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px max(14px, env(safe-area-inset-bottom, 0px))',
            background: 'rgba(5,5,6,0.94)',
            borderTop: `1px solid ${G2.borderDefault}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <img
            src={selected.thumb}
            alt=""
            style={{ width: 52, height: 38, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selected.name}
            </span>
            <span style={{ fontFamily: G2.fontMono, fontSize: 11, color: G2.textTertiary }}>
              {TIERS.find((t) => t.id === difficulty)!.label} · {pieceCount}
              {wager ? ' · $5 wager' : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={start}
            style={{
              minHeight: 48,
              padding: '0 22px',
              borderRadius: 9999,
              border: 0,
              background: G2.blue,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: G2.bgPage, color: G2.textBody, fontFamily: G2.fontBody }}>
      {header}
      <div
        style={{
          display: 'flex',
          gap: 32,
          padding: '32px',
          maxWidth: 1440,
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <main style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {resumeCard}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <h1 style={{ margin: 0, fontFamily: G2.fontDisplay, fontWeight: 800, fontSize: 32, color: '#fff' }}>
              Pick a puzzle
            </h1>
            {tabs}
          </div>
          {chips}
          {grid}
        </main>
        {setup}
      </div>
    </div>
  );
}
