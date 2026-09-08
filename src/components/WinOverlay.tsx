/**
 * Completion overlay: the finished picture (static image zoom-out + light sweep,
 * or the looping video) fills the board, a blue glow ripples out from the
 * centre, then a stats card fades in with the finish time and this config's
 * best-five leaderboard. Ported from the prototype's `isWon` block.
 */
import { BOARD_H, BOARD_OFFSET_X, BOARD_OFFSET_Y, BOARD_W } from '../game/constants';

interface Props {
  isImageMode: boolean;
  imageSrc: string;
  timeLabel: string;
  bestTimes: number[];
  currentTime: number;
  showStatsCard: boolean;
  configKey: string;
  setRevealVideoRef: (el: HTMLVideoElement | null) => void;
  onPlayAgain: () => void;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function WinOverlay({
  isImageMode,
  imageSrc,
  timeLabel,
  bestTimes,
  currentTime,
  showStatsCard,
  setRevealVideoRef,
  onPlayAgain,
}: Props) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: BOARD_OFFSET_X,
          top: BOARD_OFFSET_Y,
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
          left: 560,
          top: 380,
          width: 640,
          height: 640,
          marginLeft: -320,
          marginTop: -320,
          borderRadius: '50%',
          background:
            'radial-gradient(circle,rgba(0,82,255,.55) 0%,rgba(0,82,255,.22) 35%,rgba(0,82,255,0) 70%)',
          pointerEvents: 'none',
          zIndex: 1600,
          animation: 'puzzleGlowRipple 1.4s ease-out',
        }}
      />

      {showStatsCard && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.45)',
            zIndex: 1700,
          }}
        >
          <div
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(0,82,255,.4)',
              borderRadius: 16,
              padding: '32px 40px',
              textAlign: 'center',
              boxShadow:
                '0 30px 80px rgba(0,0,0,.7),0 0 40px rgba(0,82,255,.15)',
              animation: 'statsPopIn .45s cubic-bezier(.22,1,.36,1)',
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 6,
                color: '#f2ede6',
              }}
            >
              Solved!
            </div>
            <div style={{ fontSize: 13, color: '#8a93a6', marginBottom: 18 }}>
              Finished in {timeLabel}
            </div>

            {bestTimes.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: '#5f6578',
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                    marginBottom: 8,
                  }}
                >
                  Best times · this puzzle
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minWidth: 200,
                  }}
                >
                  {bestTimes.map((t, i) => {
                    const isThis = t === currentTime;
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 24,
                          padding: '5px 10px',
                          borderRadius: 6,
                          background: isThis
                            ? 'rgba(0,82,255,.18)'
                            : 'transparent',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: isThis ? '#5b8fff' : '#c9cfdb',
                          }}
                        >
                          #{i + 1}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: isThis ? '#5b8fff' : '#c9cfdb',
                            fontWeight: isThis ? 700 : 400,
                          }}
                        >
                          {fmt(t)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onPlayAgain}
              style={{
                display: 'inline-block',
                fontSize: 13,
                color: '#fff',
                background: '#0052FF',
                border: 'none',
                borderRadius: 8,
                padding: '10px 22px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </>
  );
}
