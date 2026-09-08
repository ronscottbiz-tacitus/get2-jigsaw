/**
 * Section 2 — "Live, moving puzzles." A row of the five Live clips. Each tile
 * plays only while it's on screen (IntersectionObserver) so we never decode all
 * five at once, and retries play() on the first page interaction in case the
 * browser withheld muted-autoplay. The still poster covers the tile until the
 * video is actually presenting frames.
 */
import { useEffect, useRef, useState } from 'react';
import { VIDEOS } from '../../content/library';

/** Fires the callback once, on the first real user interaction anywhere. */
function useFirstInteraction(cb: () => void) {
  useEffect(() => {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      cb();
      for (const e of evts) window.removeEventListener(e, run);
    };
    const evts = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    for (const e of evts) window.addEventListener(e, run, { passive: true });
    return () => {
      for (const e of evts) window.removeEventListener(e, run);
    };
  }, [cb]);
}

function LiveTile({
  src,
  poster,
  name,
  nudge,
}: {
  src: string;
  poster: string;
  name: string;
  nudge: number;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // set .src imperatively; a 404 just leaves the poster showing.
    if (v.src !== new URL(src, location.href).href) v.src = src;

    const onPlaying = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);

    return () => {
      io.disconnect();
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
    };
  }, [src]);

  // retry when the page first gets a gesture (covers withheld autoplay)
  useEffect(() => {
    if (nudge === 0) return;
    const v = ref.current;
    if (v && isInView(v)) void v.play().catch(() => {});
  }, [nudge]);

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
      <video
        ref={ref}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: playing ? 1 : 0,
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

function isInView(el: Element) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}

export function LiveRow() {
  const [nudge, setNudge] = useState(0);
  useFirstInteraction(() => setNudge((n) => n + 1));

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
          <LiveTile
            key={v.key}
            src={v.src}
            poster={v.poster}
            name={v.name}
            nudge={nudge}
          />
        ))}
      </div>
    </section>
  );
}
