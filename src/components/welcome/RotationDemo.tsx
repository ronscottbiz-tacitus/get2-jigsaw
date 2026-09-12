/**
 * "Rotation changes everything." — section 2 of the marketing page. This used
 * to be the marketing hero's own effect (the top-of-page hero now runs the
 * 48-piece murmuration grid instead — see `Hero.tsx`): a real, playing
 * `<video>` (jellyfish.mp4) as the full-bleed backdrop, with eleven puzzle
 * pieces scattering out and flying back home through 90° stepped-rotation
 * snaps. See `rotationDemoAnim.ts` for the choreography.
 *
 * Every piece shows a *live* sliver of the backdrop video, sampled from the
 * current frame and cropped to exactly where the piece lands — the clip is
 * decoded once in the backdrop `<video>` and every piece is drawn from it onto
 * a single `<canvas>` each frame (the technique the in-game Live mode uses).
 *
 * The heading sits above every piece at all times; unlike the hero, there is
 * no "Start Playing" CTA here — that stays unique to the hero section.
 */
import { Component } from 'react';
import { HERO_POSTER_SRC, HERO_VIDEO_SRC } from '../../content/library';
import {
  getRotationPieceDefs,
  rotationPieceAt,
  rotationSlotVisibleAt,
  ROTATION_TOTAL,
  type RotationPieceDef,
} from './rotationDemoAnim';

interface State {
  frameW: number;
  frameH: number;
  elapsed: number;
}

const GESTURES = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

export class RotationDemo extends Component<Record<string, never>, State> {
  private raf?: number;
  private start?: number;
  private sectionEl: HTMLElement | null = null;
  private bgVideoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private measureScheduled = false;
  private resizeObs?: ResizeObserver;
  private pathCache = new Map<string, Path2D>();

  state: State = { frameW: 1440, frameH: 810, elapsed: 0 };

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
        Math.abs(w - this.state.frameW) > 1 ||
        Math.abs(h - this.state.frameH) > 1
      )
        this.setState({ frameW: w, frameH: h });
    });
  };

  private tick = (now: number) => {
    if (!this.start) this.start = now;
    const elapsed = (now - this.start) % ROTATION_TOTAL;
    this.setState({ elapsed });
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
    const { frameW, frameH } = this.state;
    ctx.clearRect(0, 0, frameW, frameH);

    const v = this.bgVideoEl;
    const ready = !!v && v.readyState >= 2 && v.videoWidth > 0;
    let coverScale = 1;
    let offX = 0;
    let offY = 0;
    if (ready && v) {
      coverScale = Math.max(frameW / v.videoWidth, frameH / v.videoHeight);
      offX = (v.videoWidth * coverScale - frameW) / 2;
      offY = (v.videoHeight * coverScale - frameH) / 2;
    }

    const defs = getRotationPieceDefs(frameW, frameH);
    const M = 160; // generous margin for rotation/scale bbox growth
    for (const def of defs) {
      const p = rotationPieceAt(def, elapsed);
      if (!p.visible) continue;
      // skip pieces flung fully off the canvas (scattered / mid-flight)
      if (
        p.left + p.w < -M ||
        p.top + p.h < -M ||
        p.left > frameW + M ||
        p.top > frameH + M
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
    const { frameW, frameH, elapsed } = this.state;
    const defs = getRotationPieceDefs(frameW, frameH);

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
            width: frameW,
            height: frameH,
            zIndex: 1,
          }}
        >
          {defs.map((def, i) => (
            <RotationSlot
              key={`s${i}`}
              def={def}
              visible={rotationSlotVisibleAt(def, elapsed)}
            />
          ))}
          <canvas
            ref={this.setCanvasRef}
            width={Math.max(1, Math.round(frameW))}
            height={Math.max(1, Math.round(frameH))}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: frameW,
              height: frameH,
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* heading — always above every piece */}
        <div
          className="font-display"
          style={{
            position: 'relative',
            zIndex: 2,
            fontWeight: 700,
            fontSize: 'clamp(26px,3.6vw,40px)',
            color: '#fff',
            textAlign: 'center',
            paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
          }}
        >
          Rotation changes everything.
        </div>
      </section>
    );
  }
}

function RotationSlot({ def, visible }: { def: RotationPieceDef; visible: boolean }) {
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
