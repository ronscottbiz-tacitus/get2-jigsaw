/**
 * Section 3 — "Curated images. Every difficulty." The full library as a card
 * grid grouped by category, plus the Live clips as static poster cards (a "LIVE"
 * label is the only distinguishing mark — no play icon, no <video>). Card style
 * matches the in-app picker: landscape thumb, two-line label.
 * Ported from the prototype's curated-grid section.
 */
import { IMAGES, VIDEOS } from '../../content/library';

interface Props {
  onStart: () => void;
  onPick?: (contentType: 'static' | 'video', src: string) => void;
}

function Card({
  thumb,
  category,
  name,
  onClick,
}: {
  thumb: string;
  category: string;
  name: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Play ${name}`}
      className="curated-card"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        display: 'block',
        width: '100%',
        padding: 0,
        border: 0,
        background: 'transparent',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          height: 130,
          background: `#241f1a url('${thumb}') center / cover no-repeat`,
        }}
      />
      <div
        style={{
          fontSize: 10,
          marginTop: 8,
          color: '#8A8F98',
          textTransform: 'uppercase',
          letterSpacing: '.04em',
        }}
      >
        {category}
      </div>
      <div style={{ fontSize: 12, marginTop: 2, color: '#f2ede6' }}>{name}</div>
    </button>
  );
}

export function CuratedGrid({ onStart, onPick }: Props) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px max(24px, env(safe-area-inset-right, 0px)) 80px max(24px, env(safe-area-inset-left, 0px))',
        gap: 44,
      }}
    >
      <div
        className="font-display"
        style={{
          fontWeight: 700,
          fontSize: 'clamp(26px,3.6vw,40px)',
          textAlign: 'center',
        }}
      >
        Curated images.
        <br />
        Every difficulty.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))',
          gap: 18,
          maxWidth: 1140,
          width: '100%',
        }}
      >
        {IMAGES.map((i) => (
          <Card
            key={i.key}
            thumb={i.thumb}
            category={i.category}
            name={i.name}
            onClick={onPick ? () => onPick('static', i.full) : undefined}
          />
        ))}
        {VIDEOS.map((v) => (
          <Card
            key={v.key}
            thumb={v.poster}
            category="Live"
            name={v.name}
            onClick={onPick ? () => onPick('video', v.src) : undefined}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onStart}
        style={{
          display: 'inline-block',
          background: 'rgba(0,82,255,.08)',
          backdropFilter: 'blur(6px)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          padding: '16px 40px',
          borderRadius: 100,
          border: '1px solid #0052FF',
          cursor: 'pointer',
          marginTop: 6,
        }}
      >
        Start Playing
      </button>
    </section>
  );
}
