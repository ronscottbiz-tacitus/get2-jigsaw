/**
 * Section 4 — "Play free. Unlock more." Two cards. Premium is waitlist-only:
 * "Notify Me" records the signup device-locally, no purchase flow.
 * Ported from the prototype's pricing section.
 */
import { useState } from 'react';
import { FREE_PERKS, PREMIUM_PERKS, isOnWaitlist, joinWaitlist } from '../../content/tiers';

const cardBase: React.CSSProperties = {
  flex: 1,
  minWidth: 280,
  maxWidth: 340,
  borderRadius: 14,
  padding: '32px 28px',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
};

export function Pricing() {
  const [joined, setJoined] = useState(isOnWaitlist());
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
          fontSize: 'clamp(26px,3.6vw,40px)',
          textAlign: 'center',
        }}
      >
        Play free. Unlock more.
      </div>
      <div
        style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 760,
          width: '100%',
        }}
      >
        <div style={{ ...cardBase, border: '1px solid rgba(255,255,255,.12)' }}>
          <div
            className="font-display"
            style={{
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '.14em',
              color: 'rgba(255,255,255,.55)',
            }}
          >
            FREE
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontSize: 14,
              color: 'rgba(255,255,255,.85)',
            }}
          >
            {FREE_PERKS.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div
            className="font-display"
            style={{ fontWeight: 700, fontSize: 20, color: '#fff' }}
          >
            Free
          </div>
        </div>

        <div
          style={{
            ...cardBase,
            border: '1px solid rgba(0,82,255,.5)',
            boxShadow: '0 0 32px rgba(0,82,255,.18)',
          }}
        >
          <div
            className="font-display"
            style={{
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '.14em',
              color: '#0052FF',
            }}
          >
            PREMIUM
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontSize: 14,
              color: 'rgba(255,255,255,.85)',
            }}
          >
            {PREMIUM_PERKS.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div
            className="font-display"
            style={{ fontWeight: 700, fontSize: 20, color: '#fff' }}
          >
            Coming soon
          </div>
          <button
            type="button"
            disabled={joined}
            onClick={() => {
              joinWaitlist();
              setJoined(true);
            }}
            style={{
              display: 'inline-block',
              textAlign: 'center',
              background: 'rgba(0,82,255,.08)',
              backdropFilter: 'blur(6px)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              padding: '12px 0',
              borderRadius: 100,
              border: '1px solid #0052FF',
              cursor: joined ? 'default' : 'pointer',
              opacity: joined ? 0.65 : 1,
            }}
          >
            {joined ? "You're on the list" : 'Notify Me'}
          </button>
        </div>
      </div>
    </section>
  );
}
