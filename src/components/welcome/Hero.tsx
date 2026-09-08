/**
 * Marketing hero. A looping choreography: six puzzle pieces fly in from off
 * frame, step-rotate to upright, land into six slots over the (jellyfish)
 * backdrop, hold on the resolved arrangement, then float back out with
 * mirrored easing before the loop repeats — a real gather-back, never a hard
 * cut. Headline "Puzzles that move." + a Start Playing CTA sit above every
 * piece at all times.
 *
 * Ported from the prototype's hero section + `heroTick`. Uses a still poster in
 * place of the jellyfish video until a real clip is dropped in (see
 * `posterSrcForKey('jellyfish')`); switching to <video> is a one-line change.
 */
import { Component } from 'react';
import { posterSrcForKey } from '../../content/library';
import { ACCENT } from '../../game/constants';
import {
  getHeroPieceDefs,
  heroPieceAt,
  heroSlotVisibleAt,
  HERO_COPY_AT,
  HERO_TOTAL,
  type HeroPieceDef,
} from './heroAnim';

const BACKDROP = posterSrcForKey('jellyfish');

interface Props {
  onStart: () => void;
}
interface State {
  heroW: number;
  heroH: number;
  elapsed: number;
  copyRevealed: boolean;
}

export class Hero extends Component<Props, State> {
  private raf?: number;
  private start?: number;
  private sectionEl: HTMLElement | null = null;
  private measureScheduled = false;
  private resizeObs?: ResizeObserver;

  state: State = { heroW: 1440, heroH: 810, elapsed: 0, copyRevealed: false };

  componentDidMount() {
    this.raf = requestAnimationFrame(this.tick);
  }
  componentWillUnmount() {
    cancelAnimationFrame(this.raf ?? 0);
    this.resizeObs?.disconnect();
  }

  private setSectionRef = (el: HTMLElement | null) => {
    if (el && el !== this.sectionEl) {
      this.sectionEl = el;
      this.resizeObs?.disconnect();
      this.resizeObs = new ResizeObserver(() => this.measure());
      this.resizeObs.observe(el);
      this.measure();
    } else if (!el) {
      this.sectionEl = null;
    }
  };

  private measure = () => {
    if (this.measureScheduled) return;
    this.measureScheduled = true;
    requestAnimationFrame(() => {
      this.measureScheduled = false;
      if (!this.sectionEl) return;
      const w = this.sectionEl.clientWidth;
      const h = this.sectionEl.clientHeight;
      if (!w || !h) return;
      if (
        Math.abs(w - this.state.heroW) > 1 ||
        Math.abs(h - this.state.heroH) > 1
      )
        this.setState({ heroW: w, heroH: h });
    });
  };

  private tick = (now: number) => {
    if (!this.start) this.start = now;
    const elapsed = (now - this.start) % HERO_TOTAL;
    const patch: Partial<State> = { elapsed };
    if (!this.state.copyRevealed && elapsed >= HERO_COPY_AT)
      patch.copyRevealed = true;
    this.setState(patch as State);
    this.raf = requestAnimationFrame(this.tick);
  };

  render() {
    const { heroW, heroH, elapsed } = this.state;
    const defs = getHeroPieceDefs(heroW, heroH);
    const bgSize = `${heroW}px ${heroH}px`;

    return (
      <section
        ref={this.setSectionRef}
        style={{
          position: 'relative',
          height: '100vh',
          minHeight: 640,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url('${BACKDROP}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,.55) 55%,rgba(0,0,0,.9) 100%)',
          }}
        />

        {/* piece layer */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: heroW,
            height: heroH,
            zIndex: 1,
          }}
        >
          {defs.map((def, i) => (
            <HeroSlot key={`s${i}`} def={def} visible={heroSlotVisibleAt(def, elapsed)} />
          ))}
          {defs.map((def, i) => {
            const p = heroPieceAt(def, elapsed);
            if (!p.visible) return null;
            return (
              <div
                key={`p${i}`}
                style={{
                  position: 'absolute',
                  left: p.left,
                  top: p.top,
                  width: p.w,
                  height: p.h,
                  transform: `rotate(${p.rot}deg) scale(${p.scale})`,
                  clipPath: `path('${p.clip}')`,
                  WebkitClipPath: `path('${p.clip}')`,
                  overflow: 'hidden',
                  filter: 'drop-shadow(0 8px 16px rgba(0,0,0,.6))',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: p.vLeft,
                    top: p.vTop,
                    width: heroW,
                    height: heroH,
                    backgroundImage: `url('${BACKDROP}')`,
                    backgroundSize: bgSize,
                    backgroundPosition: '0 0',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* headline + CTA — always above pieces */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center',
            padding: '0 24px',
          }}
        >
          <div
            className="font-display"
            style={{
              fontSize: 'clamp(46px,9vw,116px)',
              lineHeight: 0.95,
              letterSpacing: '-.01em',
              marginBottom: 30,
              animation: 'heroHeadlineIn 1.1s cubic-bezier(.2,.9,.3,1.1)',
            }}
          >
            <span style={{ fontWeight: 400, color: '#fff' }}>Puzzles that</span>
            <br />
            <span
              style={{
                fontWeight: 800,
                color: ACCENT,
                backgroundImage: 'linear-gradient(100deg,#0041cc,#3d7bff)',
                backgroundSize: '220% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
                animation: 'heroMoveAmbient 9s ease-in-out infinite',
              }}
            >
              move.
            </span>
          </div>
          <button
            type="button"
            onClick={this.props.onStart}
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
              border: `1px solid ${ACCENT}`,
              cursor: 'pointer',
              animation: 'heroCopyIn .6s cubic-bezier(.22,1,.36,1) .35s backwards',
            }}
          >
            Start Playing
          </button>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 11,
            color: 'rgba(255,255,255,.5)',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            zIndex: 2,
          }}
        >
          Scroll
        </div>
      </section>
    );
  }
}

function HeroSlot({ def, visible }: { def: HeroPieceDef; visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: def.slot.left,
          top: def.slot.top,
          width: def.w,
          height: def.h,
          clipPath: `path('${def.clip}')`,
          WebkitClipPath: `path('${def.clip}')`,
          background: '#050608',
        }}
      />
      <svg
        width={def.w}
        height={def.h}
        style={{
          position: 'absolute',
          left: def.slot.left,
          top: def.slot.top,
          overflow: 'visible',
          pointerEvents: 'none',
          animation: 'heroSlotBreathe 2.6s ease-in-out infinite',
        }}
      >
        <path
          d={def.clip}
          fill="none"
          stroke="#0052FF"
          strokeWidth={7}
          style={{ filter: 'blur(7px)', opacity: 0.85 }}
        />
        <path d={def.clip} fill="none" stroke="#4d8bff" strokeWidth={2.4} />
      </svg>
    </>
  );
}
