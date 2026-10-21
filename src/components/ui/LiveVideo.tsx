/**
 * A muted, looping Live clip for grids and previews. The poster shows until
 * the video is actually presenting frames, and the clip only plays while it's
 * on screen (IntersectionObserver), so a grid never decodes clips you can't
 * see. Respects prefers-reduced-motion by staying on the poster.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface Props {
  src: string;
  poster: string;
  style?: CSSProperties;
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function LiveVideo({ src, poster, style }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    setPlaying(false);
    // set .src imperatively; a missing file just leaves the poster showing
    v.src = src;
    const onPlaying = () => setPlaying(true);
    v.addEventListener('playing', onPlaying);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    // browsers that withheld muted autoplay get another try on first gesture
    const retry = () => void v.play().catch(() => {});
    window.addEventListener('pointerdown', retry, { once: true });
    return () => {
      io.disconnect();
      v.removeEventListener('playing', onPlaying);
      window.removeEventListener('pointerdown', retry);
      v.pause();
    };
  }, [src]);

  return (
    <span
      style={{
        position: 'relative',
        display: 'block',
        overflow: 'hidden',
        background: `#0a0a0a url('${poster}') center / cover no-repeat`,
        ...style,
      }}
    >
      <video
        ref={ref}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        aria-hidden="true"
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
    </span>
  );
}
