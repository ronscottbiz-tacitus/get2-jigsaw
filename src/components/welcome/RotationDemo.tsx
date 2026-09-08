/**
 * "Rotation changes everything." — section 3 of the marketing page.
 * See `rotationDemoAnim.ts` for the choreography. Ported from the prototype's
 * `mtnDemo` section + tick loop.
 */
import { Component } from 'react';
import { fullSrcForKey } from '../../content/library';
import {
  getMtnDefs,
  mtnPieceAt,
  MTN_TOTAL,
} from './rotationDemoAnim';

const IMG = fullSrcForKey('mountain-valley');

interface State {
  elapsed: number;
}

export class RotationDemo extends Component<Record<string, never>, State> {
  private raf?: number;
  private start?: number;
  state: State = { elapsed: 0 };

  componentDidMount() {
    this.raf = requestAnimationFrame(this.tick);
  }
  componentWillUnmount() {
    cancelAnimationFrame(this.raf ?? 0);
  }
  private tick = (now: number) => {
    if (!this.start) this.start = now;
    this.setState({ elapsed: (now - this.start) % MTN_TOTAL });
    this.raf = requestAnimationFrame(this.tick);
  };

  render() {
    const { boxW, boxH, pieces } = getMtnDefs();
    const e = this.state.elapsed;
    return (
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 24px',
          gap: 20,
        }}
      >
        <div style={{ position: 'relative', width: boxW, maxWidth: '92vw' }}>
          <div
            className="font-display"
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '100%',
              transform: 'translateX(-50%)',
              marginBottom: 120,
              width: 'max-content',
              zIndex: 1000,
              fontWeight: 700,
              fontSize: 'clamp(26px,3.6vw,40px)',
              color: '#fff',
              textAlign: 'center',
            }}
          >
            Rotation changes everything.
          </div>
          <div
            style={{
              position: 'relative',
              width: boxW,
              height: boxH,
              maxWidth: '92vw',
            }}
          >
            {pieces.map((def) => {
              const pc = mtnPieceAt(def, e);
              return (
                <div key={def.id}>
                  <div
                    style={{
                      position: 'absolute',
                      left: pc.left,
                      top: pc.top,
                      width: pc.w,
                      height: pc.h,
                      transform: `rotate(${pc.rot}deg) scale(${pc.scale})`,
                      clipPath: `path('${pc.clip}')`,
                      WebkitClipPath: `path('${pc.clip}')`,
                      backgroundImage: `url('${IMG}')`,
                      backgroundSize: `${boxW}px ${boxH}px`,
                      backgroundPosition: `${pc.bgX}px ${pc.bgY}px`,
                      boxShadow: pc.shadow,
                      zIndex: pc.z,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: pc.left,
                      top: pc.top,
                      width: pc.w,
                      height: pc.h,
                      borderRadius: 10,
                      background:
                        'radial-gradient(circle,rgba(0,82,255,.55) 0%,rgba(0,82,255,0) 70%)',
                      opacity: pc.glow,
                      pointerEvents: 'none',
                      transform: `scale(${pc.scale})`,
                      zIndex: pc.z,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }
}
