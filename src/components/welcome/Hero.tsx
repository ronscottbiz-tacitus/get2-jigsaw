/**
 * Marketing hero.
 *
 * A real, playing `<video>` (jellyfish.mp4) is the full-bleed backdrop. Over it,
 * eleven puzzle pieces run one continuous loop: they start solved in their own
 * holes → scatter out to the opposite side of the frame (staggered) → hold →
 * fly all the way back across, rotating home through 90° steps with a spring
 * bounce (Moderate's `steppedAngle` curve) → re-solved → loop. Because every
 * piece is at its hole, rotation 0, scale 1 at both ends of the loop, the wrap
 * is seamless — no jump. See `heroAnim.ts` for the timeline.
 *
 * Every piece shows a *live* sliver of that same video, sampled from the current
 * frame and cropped to exactly where the piece lands, so a gathered piece
 * blends seamlessly into the backdrop. Rather than mount eleven `<video>`
 * elements (which would drift out of sync), the clip is decoded once in the
 * backdrop `<video>` and every piece is drawn from it onto a single `<canvas>`
 * each frame — the technique the in-game Live mode uses. One decoder, all
 * pieces frame-locked to the backdrop.
 *
 * Headline "Puzzles that move." + a Start Playing CTA sit above every piece at
 * all times.
 */
import { Component } from 'react';
import { HERO_POSTER_SRC, HERO_VIDEO_SRC } from '../../content/library';
import { ACCENT } from '../../game/constants';
import {
  getHeroPieceDefs,
  heroPieceAt,
  heroSlotVisibleAt,
  HERO_COPY_AT,
  HERO_TOTAL,
  type HeroPieceDef,
} from './heroAnim';

interface Props {
  onStart: () => void;
}
interface State {
  heroW: number;
  heroH: number;
  elapsed: number;
  copyRevealed: boolean;
}

const GESTURES = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

export class Hero extends Component<Props, State> {
  private raf?: number;
  private start?: number;
  private sectionEl: HTMLElement | null = null;
  private bgVideoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private measureScheduled = false;
  private resizeObs?: ResizeObserver;
  private pathCache = new Map<string, Path2D>();

  state: State = { heroW: 1440, heroH: 810, elapsed: 0, copyRevealed: false };

  componentDidMount() {
    this.raf = requestAnimationFrame(this.tick);
    // muted autoplay is normally allowed, but nudge it — and retry on the first
    // real interaction if the browser withheld it.
    this.tryPlay();
    window.setTimeout(this.tryPlay, 300);
    for (const e of GESTURES)
      window.addEventListener(e, this.tryPlay, { passive: true });
    document.addEventListener('visibilitychange', this.tryPlay);
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.raf ?? 0);
    this.resizeObs?.disconnect();
    for (const e of GESTURES) window.removeEventListener(e, this.tryPlay);
    document.removeEventListener('visibilitychange', this.tryPlay);
  }

  private tryPlay = () => {
    const v = this.bgVideoEl;
    if (v && v.paused && !document.hidden) v.play().catch(() => {});
  };

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

  private setBgVideoRef = (el: HTMLVideoElement | null) => {
    this.bgVideoEl = el;
    if (el) {
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      if (!el.src) el.src = HERO_VIDEO_SRC;
      el.play().catch(() => {});
    }
  };

  private setCanvasRef = (el: HTMLCanvasElement | null) => {
    this.canvasEl = el;
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
    this.drawPieces(elapsed);
    this.raf = requestAnimationFrame(this.tick);
  };

  private pathFor(d: string): Path2D {
    let p = this.pathCache.get(d);
    if (!p) {
      p = new Path2D(d);
      this.pathCache.set(d, p);
    }
    return p;
  }

  /** Draw every visible piece as a clipped, transformed slice of the backdrop
   * video's current frame. Cover-fit matches the backdrop `<video>`'s
   * `object-fit: cover`, so a landed piece is pixel-aligned with the backdrop. */
  private drawPieces(elapsed: number) {
    const canvas = this.canvasEl;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { heroW, heroH } = this.state;
    ctx.clearRect(0, 0, heroW, heroH);

    const v = this.bgVideoEl;
    const ready = !!v && v.readyState >= 2 && v.videoWidth > 0;
    let coverScale = 1;
    let offX = 0;
    let offY = 0;
    if (ready && v) {
      coverScale = Math.max(heroW / v.videoWidth, heroH / v.videoHeight);
      offX = (v.videoWidth * coverScale - heroW) / 2;
      offY = (v.videoHeight * coverScale - heroH) / 2;
    }

    const defs = getHeroPieceDefs(heroW, heroH);
    const M = 160; // generous margin for rotation/scale bbox growth
    for (const def of defs) {
      const p = heroPieceAt(def, elapsed);
      if (!p.visible) continue;
      // skip pieces flung fully off the canvas (scattered / mid-flight)
      if (
        p.left + p.w < -M ||
        p.top + p.h < -M ||
        p.left > heroW + M ||
        p.top > heroH + M
      )
        continue;
      const path = this.pathFor(p.clip);
      const xform = () => {
        ctx.translate(p.left + p.w / 2, p.top + p.h / 2);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.scale(p.scale, p.scale);
        ctx.translate(-p.w / 2, -p.h / 2);
      };

      // pass 1 — cast the soft photo-cutout drop shadow. `clip()` would also
      // clip the shadow away, so fill the shape (hidden under pass 2) with the
      // filter on and no clip.
      ctx.save();
      xform();
      ctx.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))';
      ctx.fillStyle = '#000';
      ctx.fill(path);
      ctx.restore();

      // pass 2 — the live video slice, clipped to the piece shape
      ctx.save();
      xform();
      ctx.clip(path);
      if (ready && v) {
        // source rect in video pixels for the display-space window at the slot
        const sx = (offX + p.slotLeft) / coverScale;
        const sy = (offY + p.slotTop) / coverScale;
        const sw = p.w / coverScale;
        const sh = p.h / coverScale;
        try {
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, p.w, p.h);
        } catch {
          /* frame not decodable yet */
        }
      } else {
        ctx.fillStyle = '#0a1a30';
        ctx.fillRect(0, 0, p.w, p.h);
      }
      ctx.restore();
    }
  }

  render() {
    const { heroW, heroH, elapsed } = this.state;
    const defs = getHeroPieceDefs(heroW, heroH);

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
        {/* live backdrop */}
        <video
          ref={this.setBgVideoRef}
          src={HERO_VIDEO_SRC}
          poster={HERO_POSTER_SRC}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
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

        {/* piece layer: slot outlines (DOM) + pieces (canvas) */}
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
            <HeroSlot
              key={`s${i}`}
              def={def}
              visible={heroSlotVisibleAt(def, elapsed)}
            />
          ))}
          <canvas
            ref={this.setCanvasRef}
            width={Math.max(1, Math.round(heroW))}
            height={Math.max(1, Math.round(heroH))}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: heroW,
              height: heroH,
              pointerEvents: 'none',
            }}
          />
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
