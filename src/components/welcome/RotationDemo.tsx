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
  scale: number;
}

export class RotationDemo extends Component<Record<string, never>, State> {
  private raf?: number;
  private start?: number;
  private wrapEl: HTMLDivElement | null = null;
  private resizeObs?: ResizeObserver;
  state: State = { elapsed: 0, scale: 1 };

  componentDidMount() {
    this.raf = requestAnimationFrame(this.tick);
  }
  componentWillUnmount() {
    cancelAnimationFrame(this.raf ?? 0);
    this.resizeObs?.disconnect();
  }
  private tick = (now: number) => {
    if (!this.start) this.start = now;
    this.setState({ elapsed: (now - this.start) % MTN_TOTAL });
    this.raf = requestAnimationFrame(this.tick);
  };

  // The piece geometry (rotationDemoAnim.ts) is generated once at a fixed
  // 600x450 "logical" canvas — its jigsaw edges/positions are randomized and
  // must stay stable for the life of the animation. Rather than regenerate
  // that geometry per resize (which would reshuffle the edges and every
  // piece's rotate-in target), we measure the actual container width and
  // apply one uniform CSS scale to the whole logical canvas, so every piece's
  // position and size shrinks/grows proportionally with real available space.
  private setWrapRef = (el: HTMLDivElement | null) => {
    if (el && el !== this.wrapEl) {
      this.wrapEl = el;
      this.resizeObs?.disconnect();
      this.resizeObs = new ResizeObserver(() => this.measure());
      this.resizeObs.observe(el);
      this.measure();
    } else if (!el) {
      this.wrapEl = null;
    }
  };

  private measure = () => {
    const el = this.wrapEl;
    if (!el) return;
    const w = el.clientWidth;
    if (!w) return;
    const { boxW } = getMtnDefs();
    const scale = Math.min(1, w / boxW);
    if (Math.abs(scale - this.state.scale) > 0.001) this.setState({ scale });
  };

  render() {
    const { boxW, boxH, pieces } = getMtnDefs();
    const { elapsed: e, scale } = this.state;
    return (
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px max(24px, env(safe-area-inset-right, 0px)) 80px max(24px, env(safe-area-inset-left, 0px))',
          gap: 20,
        }}
      >
        <div ref={this.setWrapRef} style={{ position: 'relative', width: '100%', maxWidth: boxW }}>
          <div
            className="font-display"
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '100%',
              transform: 'translateX(-50%)',
              marginBottom: 120,
              width: 'max-content',
              maxWidth: '90vw',
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
              width: boxW * scale,
              height: boxH * scale,
              margin: '0 auto',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: boxW,
                height: boxH,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
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
        </div>
      </section>
    );
  }
}
