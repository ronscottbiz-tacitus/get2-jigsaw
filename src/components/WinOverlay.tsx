/**
 * Completion: two parts.
 *  - <WinReveal> sits inside the (scaled) stage: the finished picture fills the
 *    board (static zoom-out + light sweep, or the looping video) and a glow
 *    ripples out from the board's centre. Ported from the prototype.
 *  - <WinCard> is a full-screen results card rendered OUTSIDE the stage, so it
 *    stays readable on a phone where the stage is scaled to ~40%: finish time,
 *    personal-best badge, wager result, this config's best times, and "Up next"
 *    suggestions so a solve leads straight into another puzzle.
 */
import { BOARD_H, BOARD_W, G2, GAME_ACCENT_BORDER, formatMoney } from '../game/constants';
import { CloseIcon } from './ui/icons';

/* ----------------------------------------------------------------------- */

interface RevealProps {
  isImageMode: boolean;
  imageSrc: string;
  boardX: number;
  boardY: number;
  setRevealVideoRef: (el: HTMLVideoElement | null) => void;
}

export function WinReveal({ isImageMode, imageSrc, boardX, boardY, setRevealVideoRef }: RevealProps) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: boardX,
          top: boardY,
          width: BOARD_W,
          height: BOARD_H,
          borderRadius: 4,
          overflow: 'hidden',
          zIndex: 1500,
        }}
      >
        {isImageMode ? (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url('${imageSrc}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                animation: 'puzzleZoomOut 3.5s ease-out forwards',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(75deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%)',
                animation: 'puzzleLightSweep 1.6s ease-out .1s',
              }}
            />
          </>
        ) : (
          <video
            ref={setRevealVideoRef}
            muted
            loop
            playsInline
            autoPlay
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              animation: 'puzzleFadeIn .5s ease-out',
            }}
          />
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          left: boardX + BOARD_W / 2,
          top: boardY + BOARD_H / 2,
          width: 640,
          height: 640,
          marginLeft: -320,
          marginTop: -320,
          borderRadius: '50%',
          background:
            'radial-gradient(circle,rgba(139,92,246,.5) 0%,rgba(0,82,255,.22) 35%,rgba(0,82,255,0) 70%)',
          pointerEvents: 'none',
          zIndex: 1600,
          animation: 'puzzleGlowRipple 1.4s ease-out',
        }}
      />
    </>
  );
}

/* ----------------------------------------------------------------------- */

export interface UpNextItem {
  key: string;
  label: string;
  thumb: string;
  live: boolean;
  onPick: () => void;
}

interface CardProps {
  title: string;
  metaLabel: string;
  timeLabel: string;
  bestTimes: number[];
  currentTime: number;
  /** net $ from a wager round that just resolved (+won / −lost); null if none. */
  wagerResultNet?: number | null;
  wagerBalance: number;
  upNext: UpNextItem[];
  isPhone: boolean;
  onAllPuzzles: () => void;
  onDismiss: () => void;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const tileLabel: React.CSSProperties = {
  fontFamily: G2.fontCondensed,
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: G2.textTertiary,
};

export function WinCard(p: CardProps) {
  const isBest = p.bestTimes.length > 0 && p.bestTimes[0] === p.currentTime;
  const badge =
    p.bestTimes.length === 1 ? 'FIRST SOLVE' : isBest ? 'NEW PERSONAL BEST' : null;
  const wagerWon = p.wagerResultNet != null && p.wagerResultNet >= 0;
  const wagerText =
    p.wagerResultNet == null
      ? null
      : `${p.wagerResultNet >= 0 ? '+' : '−'}$${Math.abs(p.wagerResultNet).toFixed(2)}`;
  const thisIndex = p.bestTimes.indexOf(p.currentTime);
  const next = p.upNext[0];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2500,
        background: 'rgba(5,5,6,0.55)',
        display: 'flex',
        alignItems: p.isPhone ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: p.isPhone ? 0 : 24,
        overflowY: 'auto',
      }}
    >
      <section
        role="dialog"
        aria-label="Puzzle solved"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 620,
          boxSizing: 'border-box',
          padding: p.isPhone ? '24px 20px max(24px, env(safe-area-inset-bottom, 0px))' : 36,
          borderRadius: p.isPhone ? '20px 20px 0 0' : 18,
          background: 'rgba(12,13,16,0.97)',
          border: `1px solid ${G2.borderDefault}`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: p.isPhone ? 20 : 26,
          color: G2.textBody,
          fontFamily: G2.fontBody,
          animation: p.isPhone ? 'sheetSlideUp .4s cubic-bezier(.22,1,.36,1)' : 'statsPopIn .45s cubic-bezier(.22,1,.36,1)',
        }}
      >
        <button
          type="button"
          onClick={p.onDismiss}
          aria-label="Close and view the finished puzzle"
          title="View the finished puzzle"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 44,
            height: 44,
            border: 0,
            background: 'transparent',
            color: G2.textSecondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CloseIcon size={20} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          {badge && (
            <span
              style={{
                padding: '5px 10px',
                borderRadius: 9999,
                background: 'rgba(124,58,237,0.2)',
                border: `1px solid ${GAME_ACCENT_BORDER}`,
                fontFamily: G2.fontMono,
                fontWeight: 700,
                fontSize: 10.5,
                letterSpacing: '.1em',
                color: '#DDD6FE',
              }}
            >
              {badge}
            </span>
          )}
          <h2
            style={{
              margin: 0,
              fontFamily: G2.fontDisplay,
              fontWeight: 800,
              fontSize: p.isPhone ? 26 : 34,
              lineHeight: 1.1,
              color: '#fff',
            }}
          >
            Solved in {p.timeLabel}
          </h2>
          <span style={{ fontSize: 14, color: G2.textSecondary }}>
            {p.title} · {p.metaLabel}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: wagerText != null ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
            gap: 12,
          }}
        >
          {wagerText != null && (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: G2.bgPanelAlt,
                border: `1px solid ${G2.borderSubtle}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={tileLabel}>Wager {wagerWon ? 'won' : 'lost'}</span>
              <span
                style={{
                  fontFamily: G2.fontMono,
                  fontWeight: 700,
                  fontSize: 22,
                  color: wagerWon ? '#6EE7B7' : '#FCA5A5',
                }}
              >
                {wagerText}
              </span>
              <span style={{ fontSize: 12.5, color: G2.textTertiary }}>
                Balance now {formatMoney(p.wagerBalance)}
              </span>
            </div>
          )}
          {p.bestTimes.length > 0 && (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: G2.bgPanelAlt,
                border: `1px solid ${G2.borderSubtle}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={tileLabel}>Best times · this puzzle</span>
              {p.bestTimes.slice(0, 3).map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: G2.fontMono,
                    fontSize: 13,
                    color: i === thisIndex ? '#fff' : G2.textTertiary,
                    fontWeight: i === thisIndex ? 700 : 400,
                  }}
                >
                  <span>{i + 1}</span>
                  <span>{fmt(t)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {p.upNext.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ ...tileLabel, fontSize: 12 }}>Up next</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {p.upNext.map((u) => (
                <button
                  key={u.key}
                  type="button"
                  onClick={u.onPick}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    color: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ position: 'relative', display: 'block', width: '100%' }}>
                    <img
                      src={u.thumb}
                      alt=""
                      style={{
                        width: '100%',
                        aspectRatio: '7 / 5',
                        objectFit: 'cover',
                        borderRadius: 10,
                        display: 'block',
                      }}
                    />
                    {u.live && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          padding: '3px 7px',
                          borderRadius: 9999,
                          background: 'rgba(5,5,6,0.72)',
                          fontFamily: G2.fontMono,
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#fff',
                        }}
                      >
                        ● LIVE
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{u.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {next && (
            <button
              type="button"
              onClick={next.onPick}
              style={{
                flex: '1 1 200px',
                minHeight: 52,
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
              Next puzzle
            </button>
          )}
          <button
            type="button"
            onClick={p.onAllPuzzles}
            style={{
              flex: '1 1 160px',
              minHeight: 52,
              borderRadius: 9999,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'transparent',
              color: G2.textBody,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            All puzzles
          </button>
        </div>
      </section>
    </div>
  );
}
