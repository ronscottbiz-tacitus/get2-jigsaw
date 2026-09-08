/**
 * Section 2 — "Live, moving puzzles." A row of the five Live clips. Where a
 * real .mp4 exists it autoplays; until then the still poster carries the tile
 * (with a faint sheen so the row doesn't read as dead).
 */
import { useEffect, useRef } from 'react';
import { VIDEOS } from '../../content/library';

function LiveTile({ src, poster, name }: { src: string; poster: string; name: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // set .src imperatively; if the file 404s the poster simply stays visible.
    v.src = src;
    const show = () => {
      v.style.opacity = '1';
    };
    v.addEventListener('canplay', show);
    void v.play().catch(() => {});
    return () => v.removeEventListener('canplay', show);
  }, [src]);

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '3 / 4',
        borderRadius: 10,
        overflow: 'hidden',
        background: `#0a0a0a url('${poster}') center / cover no-repeat`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(115deg,transparent 30%,rgba(255,255,255,.06) 50%,transparent 70%)',
          backgroundSize: '250% 100%',
          animation: 'heroMoveAmbient 6s ease-in-out infinite',
        }}
      />
      <video
        ref={ref}
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
          opacity: 0,
          transition: 'opacity .4s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '16px 14px',
          background: 'linear-gradient(0deg,rgba(0,0,0,.75),transparent)',
          fontSize: 13,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: '#fff',
        }}
      >
        {name}
      </div>
    </div>
  );
}

export function LiveRow() {
  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        gap: 48,
      }}
    >
      <div
        className="font-display"
        style={{
          fontWeight: 700,
          fontSize: 'clamp(28px,4vw,44px)',
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        Live, moving puzzles.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5,1fr)',
          gap: 14,
          width: '100%',
          maxWidth: 1400,
          padding: '0 40px',
          boxSizing: 'border-box',
        }}
      >
        {VIDEOS.map((v) => (
          <LiveTile key={v.key} src={v.src} poster={v.poster} name={v.name} />
        ))}
      </div>
    </section>
  );
}
