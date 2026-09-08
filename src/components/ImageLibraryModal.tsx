/**
 * "Choose an image" picker. Ported from the prototype's `libraryOpen` modal —
 * same card style as the marketing grid (landscape thumb, two-line label:
 * category in small caps, then name). Premium-tier items are shown but locked
 * (waitlist only) until entitlement exists.
 */
import type { Category, ImageItem, Tier } from '../content/library';

interface Props {
  groups: [Category, ImageItem[]][];
  currentSrc: string;
  canAccess: (tier: Tier) => boolean;
  onPick: (src: string) => void;
  onClose: () => void;
}

export function ImageLibraryModal({
  groups,
  currentSrc,
  canAccess,
  onPick,
  onClose,
}: Props) {
  const items = groups.flatMap(([, list]) => list);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#171310',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 16,
          padding: 28,
          maxWidth: 1240,
          width: '100%',
          maxHeight: '82vh',
          overflow: 'auto',
          boxShadow: '0 40px 90px rgba(0,0,0,.6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f2ede6' }}>
            Choose an image
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              cursor: 'pointer',
              color: '#a39a8d',
              fontSize: 13,
              background: 'transparent',
              border: 'none',
            }}
          >
            Close
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))',
            gap: 18,
          }}
        >
          {items.map((item) => {
            const selected = item.full === currentSrc;
            const locked = !canAccess(item.tier);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => !locked && onPick(item.full)}
                aria-disabled={locked}
                style={{
                  cursor: locked ? 'not-allowed' : 'pointer',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 8,
                    overflow: 'hidden',
                    height: 130,
                    backgroundImage: `url('${item.thumb}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: '#241f1a',
                    boxShadow: selected
                      ? '0 0 0 2px #3fae7d'
                      : '0 0 0 1px rgba(255,255,255,.08)',
                  }}
                >
                  {locked && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        color: '#fff',
                        background: 'rgba(0,82,255,.85)',
                        borderRadius: 100,
                        padding: '3px 8px',
                      }}
                    >
                      Premium
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    marginTop: 8,
                    color: '#7a7267',
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                  }}
                >
                  {item.category}
                </div>
                <div style={{ fontSize: 12, marginTop: 2, color: '#f2ede6' }}>
                  {item.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
