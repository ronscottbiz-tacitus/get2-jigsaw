/** Mid-game resume modal, shown on load when a valid in-progress puzzle is
 * found in localStorage. Ported from the prototype's `showResumePrompt` block. */
interface Props {
  summary: string;
  onResume: () => void;
  onStartNew: () => void;
}

export function ResumePrompt({ summary, onResume, onStartNew }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: 40,
      }}
    >
      <div
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(0,82,255,.35)',
          borderRadius: 16,
          padding: '32px 36px',
          maxWidth: 380,
          textAlign: 'center',
          boxShadow: '0 40px 90px rgba(0,0,0,.6)',
        }}
      >
        <div
          style={{ fontSize: 17, fontWeight: 700, color: '#f2ede6', marginBottom: 8 }}
        >
          Resume your puzzle?
        </div>
        <div style={{ fontSize: 13, color: '#8a93a6', marginBottom: 24 }}>
          You have an unfinished puzzle — {summary}.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onStartNew}
            style={{
              fontSize: 13,
              color: '#a39a8d',
              border: '1px solid rgba(255,255,255,.12)',
              borderRadius: 8,
              padding: '10px 18px',
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            Start new
          </button>
          <button
            type="button"
            onClick={onResume}
            style={{
              fontSize: 13,
              color: '#fff',
              background: '#0052FF',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
