/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The puzzle engine — a faithful React port of the prototype's `Component`
 * class (`Jigsaw Board.dc.html`). Method names and bodies deliberately track
 * the original so behaviour (snap feel, timing constants, intro sequence,
 * rotation tiers) matches. Pure helpers live in ./geometry, ./snap, ./sound,
 * ./persistence; this class owns state, refs, timers and rendering.
 *
 * Two render paths:
 *  - image mode: one absolutely-positioned <div> per piece, shape via
 *    clip-path, image via background-position.
 *  - video mode: a single <canvas> drawn every frame from a hidden <video>,
 *    clipping each piece's Path2D — one video decode instead of N.
 */
import type * as React from 'react';
import { Component, type CSSProperties } from 'react';
import {
  BLEED,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  BOARD_H,
  BOARD_W,
  BG_PRESETS,
  DEFAULT_DIFFICULTY,
  DEFAULT_PIECE_COUNT,
  PIECE_COUNT_PRESETS,
  STAGE_H,
  STAGE_W,
  WAGER_STAKE,
  bgCssFor,
  wagerNet,
  wagerParSeconds,
  wagerPot,
  wagerTickIntervalMs,
  wagerUrgency,
} from './constants';
import { generateGeometry } from './geometry';
import {
  clampAnchor,
  computeMagnetOffset,
  deriveClusterPositions,
  groupSize as groupSizeOf,
  tryConnectAndSnap,
} from './snap';
import { sound } from './sound';
import {
  bestTimesFor,
  clearProgress,
  configKey,
  getWagerBalance,
  isValidProgress,
  loadProgress,
  recordBestTime,
  saveProgress,
  setWagerBalance,
} from './persistence';
import type {
  ContentType,
  Difficulty,
  IntroPhase,
  Piece,
  RenderMode,
  SavedProgress,
} from './types';
import {
  DEFAULT_IMAGE_SRC,
  DEFAULT_VIDEO_SRC,
  imagesByCategory,
  labelForSrc,
} from '../content/library';
import { canAccess } from '../content/tiers';
import { ResumePrompt } from '../components/ResumePrompt';
import { ImageLibraryModal } from '../components/ImageLibraryModal';
import { WinOverlay } from '../components/WinOverlay';
import { Toolbar } from '../components/Toolbar';

export interface JigsawGameProps {
  defaultDifficulty?: Difficulty;
  defaultPieceCount?: number;
  /** re-show the marketing / welcome experience. */
  onShowWelcome?: () => void;
  /** dev-only: wipe the "seen welcome" flag and reload. */
  onDevReset?: () => void;
}

interface JigsawGameState {
  pieces: Piece[];
  solvedCount: number;
  selectedId: string | null;
  rows: number;
  cols: number;
  difficulty: Difficulty;
  showGhost: boolean;
  hintPieceId: string | null;
  timerHidden: boolean;
  elapsedSec: number;
  startTime: number;
  pulseGroupId: string | null;
  draggingGroupId: string | null;
  stageScale: number;
  bgColor: string;
  mode: RenderMode;
  contentType: ContentType;
  imageSrc: string;
  videoSrc: string;
  libraryOpen: boolean;
  showResumePrompt: boolean;
  pendingResume: SavedProgress | null;
  showStatsCard: boolean;
  introPhase: IntroPhase;
  introPulse: boolean;
  /** Wager mode (optional fake-money bet on the current round). */
  wagerActive: boolean;
  /** Par time (s) locked in for this round when the wager was armed. */
  wagerParSec: number;
  /** Persistent fake balance, loaded from localStorage on mount. */
  wagerBalance: number;
    /** Net $ result of the just-resolved wager round, for the win overlay
   * (positive = won, negative = lost). null when no wager was in play. */
  wagerResultNet: number | null;
  /** Continuously-updated elapsed seconds while a wager is live, driven by
   * the dedicated nickel-cadence ticker (not the once-per-second display
   * clock) — this is what the gauge and its color/urgency read from. */
  wagerElapsedSec: number;
}

interface DragState {
  groupId: string;
  startX: number;
  startY: number;
  anchorHomeLeft: number;
  anchorHomeTop: number;
  anchorStartLeft: number;
  anchorStartTop: number;
  memberIds: Set<string>;
}

export class JigsawGame extends Component<JigsawGameProps, JigsawGameState> {
  // derived per-puzzle dims (set by generateGeometry / computeDerivedDims)
  private magnetRadius = 0;
  private snapTol = 14;

  // transient interaction state (not React state — no re-render needed)
  private drag: DragState | null = null;
  private rotateDrag: { id: string; cx: number; cy: number } | null = null;
  private lastDownId: string | null = null;
  private lastDownTime = 0;
  private wonHandled = false;

  // DOM refs
  private canvasEl: HTMLCanvasElement | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private ghostVideoEl: HTMLVideoElement | null = null;
  private stageEl: HTMLDivElement | null = null;
  private hostEl: HTMLDivElement | null = null;

  // caches / timers
  private pathCache: Record<string, Path2D & { _d?: string }> = {};
  private hitCtx: CanvasRenderingContext2D | null = null;
  private timer?: number;
  private saveTimer?: number;
  private wagerTimer?: number;
  private hintTO?: number;
  private pulseTO?: number;
  private statsTO?: number;
  private introPulseTO?: number;
  private introFallbackTO?: number;
  private introRaf?: number;
  private drawRaf?: number;
  private lastCanvasDraw = 0;
  private measureScheduled = false;
  private resizeObs?: ResizeObserver;

  state: JigsawGameState = {
    pieces: [],
    solvedCount: 0,
    selectedId: null,
    rows: 6,
    cols: 8,
    difficulty: DEFAULT_DIFFICULTY,
    showGhost: false,
    hintPieceId: null,
    timerHidden: false,
    elapsedSec: 0,
    startTime: Date.now(),
    pulseGroupId: null,
    draggingGroupId: null,
    stageScale: 1,
    bgColor: BG_PRESETS[0].hex,
    mode: 'image',
    contentType: 'static',
    imageSrc: DEFAULT_IMAGE_SRC,
    videoSrc: DEFAULT_VIDEO_SRC,
    libraryOpen: false,
    showResumePrompt: false,
    pendingResume: null,
    showStatsCard: false,
    introPhase: null,
    introPulse: false,
    wagerActive: false,
    wagerParSec: 0,
    wagerBalance: getWagerBalance(),
    wagerResultNet: null,
    wagerElapsedSec: 0,
  };

  // ---- lifecycle -------------------------------------------------------

  componentDidMount() {
    let saved: SavedProgress | null = null;
    try {
      saved = loadProgress();
      if (saved && !isValidProgress(saved)) {
        saved = null;
        clearProgress();
      }
    } catch {
      saved = null;
    }

    if (saved) {
      this.setState({ showResumePrompt: true, pendingResume: saved });
    } else {
      const d = this.props.defaultDifficulty || DEFAULT_DIFFICULTY;
      const n = Number(this.props.defaultPieceCount || DEFAULT_PIECE_COUNT);
      const preset = PIECE_COUNT_PRESETS[n] || PIECE_COUNT_PRESETS[DEFAULT_PIECE_COUNT];
      this.newGame(preset[0], preset[1], d);
    }

      this.timer = window.setInterval(() => {
      const s = this.state;
      if (s.pieces.length && !s.introPhase && s.solvedCount !== s.pieces.length) {
        this.setState((st) => ({
          elapsedSec: Math.floor((Date.now() - st.startTime) / 1000),
        }));
      }
    }, 1000);
    this.saveTimer = window.setInterval(this.persist, 5000);

    window.addEventListener('resize', this.measureScale);
    requestAnimationFrame(this.measureScale);
    this.drawRaf = requestAnimationFrame(this.drawVideoFrame);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    clearInterval(this.saveTimer);
    this.stopWagerTicker();
    clearTimeout(this.hintTO);
    clearTimeout(this.pulseTO);
    clearTimeout(this.statsTO);
    clearTimeout(this.introFallbackTO);
    clearTimeout(this.introPulseTO);
    cancelAnimationFrame(this.introRaf ?? 0);
    cancelAnimationFrame(this.drawRaf ?? 0);
    window.removeEventListener('resize', this.measureScale);
    this.resizeObs?.disconnect();
  }

  // ---- derived dims / stage scale ------------------------------------

  private computeDerivedDims(rows: number, cols: number) {
    const cellW = BOARD_W / cols;
    const cellH = BOARD_H / rows;
    this.magnetRadius = Math.min(cellW, cellH) * 0.9;
    this.snapTol = Math.max(14, Math.min(cellW, cellH) * 0.24);
  }

  private setStageRef = (el: HTMLDivElement | null) => {
    this.stageEl = el;
  };

  private setStageHostRef = (el: HTMLDivElement | null) => {
    if (el && el !== this.hostEl) {
      this.hostEl = el;
      this.resizeObs?.disconnect();
      this.resizeObs = new ResizeObserver(() => this.measureScale());
      this.resizeObs.observe(el);
      this.measureScale();
    } else if (!el) {
      this.hostEl = null;
    }
  };

  private measureScale = () => {
    if (this.measureScheduled) return;
    this.measureScheduled = true;
    requestAnimationFrame(() => {
      this.measureScheduled = false;
      if (!this.hostEl) return;
      const w = this.hostEl.clientWidth;
      if (!w) return;
      const scale = Math.min(1, w / STAGE_W);
      if (Math.abs(scale - this.state.stageScale) > 0.005) {
        this.setState({ stageScale: scale });
      }
    });
  };

  // ---- persistence --------------------------------------------------

  private persist = () => {
    const s = this.state;
    if (!s.pieces.length || s.solvedCount === s.pieces.length || s.showResumePrompt)
      return;
    saveProgress({
      pieces: s.pieces,
      rows: s.rows,
      cols: s.cols,
      difficulty: s.difficulty,
      contentType: s.contentType,
      imageSrc: s.imageSrc,
      videoSrc: s.videoSrc,
      bgColor: s.bgColor,
      elapsedSec: s.elapsedSec,
      savedAt: Date.now(),
    });
  };

  private handleWin = () => {
    if (this.wonHandled) return;
    this.wonHandled = true;
    clearProgress();
    recordBestTime(this.state, this.state.elapsedSec);
    sound.winChime();

 // settle the wager, if one was in play for this round
    if (this.state.wagerActive) {
      this.stopWagerTicker();
      const net =
        Math.round(wagerNet(this.state.elapsedSec, this.state.wagerParSec) * 100) /
        100;
      const newBalance =
        Math.round((this.state.wagerBalance + net) * 100) / 100;
      setWagerBalance(newBalance);
      if (net >= 0) sound.wagerWin();
      else sound.wagerLoss();
      this.setState({
        wagerBalance: newBalance,
        wagerActive: false,
        wagerResultNet: net,
      });
    }

    clearTimeout(this.statsTO);
    this.setState({ showStatsCard: false });
    this.statsTO = window.setTimeout(
      () => this.setState({ showStatsCard: true }),
      900,
    );
  };

  private resumeGame = () => {
    const saved = this.state.pendingResume;
    if (!saved || !isValidProgress(saved)) {
      this.startFreshFromPrompt();
      return;
    }
    this.pathCache = {};
    this.wonHandled = false;
    this.computeDerivedDims(saved.rows, saved.cols);
    this.setState({
      pieces: saved.pieces,
      rows: saved.rows,
      cols: saved.cols,
      difficulty: saved.difficulty,
      contentType: saved.contentType,
      mode: saved.contentType === 'video' ? 'video' : 'image',
      imageSrc: saved.imageSrc,
      videoSrc: saved.videoSrc,
      bgColor: saved.bgColor || this.state.bgColor,
      elapsedSec: saved.elapsedSec,
      startTime: Date.now() - saved.elapsedSec * 1000,
      solvedCount: saved.pieces.filter((p) => p.solved).length,
      showResumePrompt: false,
      pendingResume: null,
      selectedId: null,
      draggingGroupId: null,
      pulseGroupId: null,
      hintPieceId: null,
      showStatsCard: false,
   // a resumed round never carries a live wager (par time isn't persisted).
      wagerActive: false,
      wagerParSec: 0,
      wagerResultNet: null,
      wagerElapsedSec: 0,
    });
    this.stopWagerTicker();
    if (saved.contentType === 'video' && this.videoEl) {
      this.videoEl.currentTime = 0;
      void this.videoEl.play().catch(() => {});
    }
  };

  private startFreshFromPrompt = () => {
    clearProgress();
    this.setState({ showResumePrompt: false, pendingResume: null });
    const d = this.props.defaultDifficulty || DEFAULT_DIFFICULTY;
    const n = Number(this.props.defaultPieceCount || DEFAULT_PIECE_COUNT);
    const preset = PIECE_COUNT_PRESETS[n] || PIECE_COUNT_PRESETS[DEFAULT_PIECE_COUNT];
    this.newGame(preset[0], preset[1], d);
  };

  // ---- video / canvas refs ----------------------------------------

  private setRevealVideoRef = (el: HTMLVideoElement | null) => {
    if (!el) return;
    // set .src imperatively — never as a JSX attribute inside a conditional
    // wrapper (the browser can fetch an unresolved value before React commits).
    if (!el.src) el.src = this.state.videoSrc;
    try {
      el.currentTime = this.videoEl?.currentTime || 0;
    } catch {
      /* not ready */
    }
    void el.play().catch(() => {});
  };

  private setCanvasRef = (el: HTMLCanvasElement | null) => {
    this.canvasEl = el;
  };

  private setVideoRef = (el: HTMLVideoElement | null) => {
    this.videoEl = el;
    if (el) {
      el.loop = true;
      el.muted = true;
      if (!el.src) el.src = this.state.videoSrc;
      el.addEventListener('ended', () => {
        el.currentTime = 0;
        void el.play().catch(() => {});
      });
    }
  };

  private setGhostVideoRef = (el: HTMLVideoElement | null) => {
    this.ghostVideoEl = el;
    if (el && !el.src) el.src = this.state.videoSrc;
  };

  // ---- hit testing (video mode) ----------------------------------

  private getPath2D(p: Piece): Path2D {
    const cached = this.pathCache[p.id];
    if (!cached || cached._d !== p.pathD) {
      const path = new Path2D(p.pathD) as Path2D & { _d?: string };
      path._d = p.pathD;
      this.pathCache[p.id] = path;
    }
    return this.pathCache[p.id];
  }

  private localPointForPiece(p: Piece, mx: number, my: number) {
    const lx = mx - p.curLeft;
    const ly = my - p.curTop;
    if (!p.rotation) return { x: lx, y: ly };
    const cx = p.boxW / 2;
    const cy = p.boxH / 2;
    const rad = (-p.rotation * Math.PI) / 180;
    const dx = lx - cx;
    const dy = ly - cy;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: dx * cos - dy * sin + cx, y: dx * sin + dy * cos + cy };
  }

  private hitTestPiece(mx: number, my: number, includeSolved: boolean): Piece | null {
    const s = this.state;
    if (!this.hitCtx)
      this.hitCtx = document.createElement('canvas').getContext('2d');
    const ctx = this.hitCtx;
    if (!ctx) return null;
    const pool = includeSolved ? s.pieces : s.pieces.filter((p) => !p.solved);
    const dragging = pool.filter(
      (p) => s.draggingGroupId && p.groupId === s.draggingGroupId,
    );
    const rest = pool
      .filter((p) => !(s.draggingGroupId && p.groupId === s.draggingGroupId))
      .slice()
      .reverse();
    for (const p of [...dragging, ...rest]) {
      const path = this.getPath2D(p);
      const local = this.localPointForPiece(p, mx, my);
      if (ctx.isPointInPath(path, local.x, local.y)) return p;
    }
    return null;
  }

  private canvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!this.canvasEl || this.state.introPhase) return;
    const rect = this.canvasEl.getBoundingClientRect();
    const scale = this.state.stageScale || 1;
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const hit = this.hitTestPiece(mx, my, true);
    if (hit) {
      e.currentTarget.setPointerCapture(e.pointerId);
      this.onPieceDown(hit.id, e);
    }
  };
  private canvasPointerMove = (e: React.PointerEvent) => this.onPieceMove(null, e);
  private canvasPointerUp = (e: React.PointerEvent) => this.onPieceUp(null, e);
  private canvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!this.canvasEl) return;
    const rect = this.canvasEl.getBoundingClientRect();
    const scale = this.state.stageScale || 1;
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const hit = this.hitTestPiece(mx, my, true);
    if (hit) this.onPieceDouble(hit.id, e);
  };

  // ---- video mode draw loop ------------------------------------

  private drawVideoFrame = () => {
    this.drawRaf = requestAnimationFrame(this.drawVideoFrame);
    if (this.state.mode !== 'video' || !this.canvasEl) return;
    const now = performance.now();
    if (this.lastCanvasDraw && now - this.lastCanvasDraw < 55) return;
    this.lastCanvasDraw = now;
    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    const videoReady = !!this.videoEl && this.videoEl.readyState >= 2;
    // With a real clip: crop the board region out of the video, mapped per
    // piece. Without one (asset not present yet): fill each piece with an
    // animated procedural gradient so Live is still visibly "moving" and fully
    // playable. Drop a real .mp4 in and this branch is never taken.
    let vw = BOARD_W;
    let vh = BOARD_H;
    let k = 1;
    let cropX = 0;
    let cropY = 0;
    if (videoReady && this.videoEl) {
      vw = this.videoEl.videoWidth || BOARD_W;
      vh = this.videoEl.videoHeight || BOARD_H;
      k = Math.min(vw / BOARD_W, vh / BOARD_H);
      cropX = (vw - BOARD_W * k) / 2;
      cropY = (vh - BOARD_H * k) / 2;
    }

    const s = this.state;
    const solved = s.pieces.filter((p) => p.solved);
    const dragging = s.draggingGroupId
      ? s.pieces.filter((p) => !p.solved && p.groupId === s.draggingGroupId)
      : [];
    const rest = s.pieces.filter(
      (p) => !p.solved && !(s.draggingGroupId && p.groupId === s.draggingGroupId),
    );
    for (const p of [...solved, ...rest, ...dragging]) {
      const isDragging =
        s.draggingGroupId != null && p.groupId === s.draggingGroupId && !p.solved;
      const isClustered = !isDragging && this.groupSize(p.groupId) > 1;
      const lift = isDragging ? -6 : 0;
      const path = this.getPath2D(p);
      ctx.save();
      if (p.solved || isClustered) ctx.filter = 'none';
      else if (isDragging)
        ctx.filter = 'drop-shadow(0 18px 20px rgba(0,0,0,0.55))';
      else ctx.filter = 'drop-shadow(0 3px 4px rgba(0,0,0,0.3))';
      ctx.translate(p.curLeft, p.curTop + lift);
      const cx = p.boxW / 2;
      const cy = p.boxH / 2;
      const liftScale = isDragging ? 1.09 : 1;
      ctx.translate(cx, cy);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.scale(BLEED * liftScale, BLEED * liftScale);
      ctx.translate(-cx, -cy);
            // Faux-thickness edge: stroke the piece's own path BEFORE clipping.
      // The stroke is centered on the path, so once the video content is
      // drawn (clipped to the inner half), only the outer half remains
      // visible — reading as a cardboard rim, not a shadow. Native canvas
      // stroke, so this costs nothing like the CSS filter version did.
      ctx.lineJoin = 'round';
      ctx.strokeStyle = isDragging ? '#b8a98c' : '#cfc3a8';
      ctx.lineWidth = isDragging ? 4 : 2;
      ctx.stroke(path);
      ctx.clip(path);
      if (videoReady && this.videoEl) {
        ctx.drawImage(
          this.videoEl,
          cropX - p.bgPosX * k,
          cropY - p.bgPosY * k,
          p.boxW * k,
          p.boxH * k,
          0,
          0,
          p.boxW,
          p.boxH,
        );
      } else {
        this.paintFallbackSlice(ctx, p, now);
      }
      // Glossy sheen: same diagonal light-to-dark gradient as image mode,
      // composited with 'overlay' (canvas's equivalent of CSS mix-blend-mode).
      const sheen = ctx.createLinearGradient(0, 0, p.boxW, p.boxH);
      sheen.addColorStop(0, 'rgba(255,255,255,.35)');
      sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.65, 'rgba(0,0,0,0)');
      sheen.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, p.boxW, p.boxH);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
  };

  /** Animated stand-in for a missing Live clip: a slow-drifting two-stop
   * gradient whose hue is anchored to the piece's home position, so adjacent
   * pieces read as one continuous moving field. */
  private paintFallbackSlice(
    ctx: CanvasRenderingContext2D,
    p: Piece,
    now: number,
  ) {
    const t = now / 1000;
    const homeX = p.bgPosX; // negative of the board-relative crop origin
    const homeY = p.bgPosY;
    const hue = (200 + (homeX + homeY) * 0.25 + Math.sin(t * 0.3) * 30) % 360;
    const shift = Math.sin(t * 0.6 + (homeX + homeY) * 0.01) * 0.5 + 0.5;
    const g = ctx.createLinearGradient(0, 0, p.boxW, p.boxH);
    g.addColorStop(0, `hsl(${hue}, 55%, ${18 + shift * 12}%)`);
    g.addColorStop(1, `hsl(${(hue + 40) % 360}, 60%, ${40 + shift * 18}%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, p.boxW, p.boxH);
  }

  // ---- content selection --------------------------------------

  private setContentType = (type: ContentType) => {
    const mode: RenderMode = type === 'video' ? 'video' : 'image';
    this.setState({ contentType: type, mode });
    if (this.videoEl) {
      if (mode === 'video') {
        this.videoEl.currentTime = 0;
        void this.videoEl.play().catch(() => {});
      } else this.videoEl.pause();
    }
    this.newGame(this.state.rows, this.state.cols, this.state.difficulty);
  };

  private toggleLibrary = () =>
    this.setState((s) => ({ libraryOpen: !s.libraryOpen }));

  private selectImage = (src: string) => {
    this.setState({ imageSrc: src, libraryOpen: false });
    this.newGame(this.state.rows, this.state.cols, this.state.difficulty);
  };

  private selectVideo = (src: string) => {
    this.setState({ videoSrc: src });
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.src = src;
      setTimeout(() => {
        if (this.videoEl) {
          this.videoEl.load();
          if (this.state.mode === 'video')
            void this.videoEl.play().catch(() => {});
        }
      }, 0);
    }
    if (this.ghostVideoEl) this.ghostVideoEl.src = src;
    this.newGame(this.state.rows, this.state.cols, this.state.difficulty);
  };

  // ---- new game / intro --------------------------------------

  private newGame = (rows: number, cols: number, difficulty: Difficulty) => {
    this.pathCache = {};
    this.wonHandled = false;
    clearTimeout(this.statsTO);
    clearTimeout(this.introFallbackTO);
    clearTimeout(this.introPulseTO);
    cancelAnimationFrame(this.introRaf ?? 0);
    clearProgress();

    const geo = generateGeometry(rows, cols, difficulty);
    this.magnetRadius = geo.magnetRadius;
    this.snapTol = geo.snapTol;

    const isVideo = this.state.mode === 'video';
    if (isVideo && this.videoEl) {
      try {
        this.videoEl.currentTime = 0;
        void this.videoEl.play().catch(() => {});
      } catch {
        /* ignore */
      }
    }

    this.setState({
      pieces: geo.pieces,
      solvedCount: 0,
      selectedId: null,
      rows,
      cols,
      difficulty,
      startTime: Date.now(),
      elapsedSec: 0,
      hintPieceId: null,
      draggingGroupId: null,
      pulseGroupId: null,
      showStatsCard: false,
      introPhase: 'hold',
      introPulse: false,
      // if the wager toggle is armed, lock this round's par time now.
      wagerParSec: this.state.wagerActive
        ? wagerParSeconds(rows * cols, difficulty)
        : 0,
      wagerResultNet: null,
      wagerElapsedSec: 0,
    });
    if (this.state.wagerActive) {
      this.startWagerTicker(wagerParSeconds(rows * cols, difficulty));
    } else {
      this.stopWagerTicker();
    }

    this.introPulseTO = window.setTimeout(() => {
      if (this.state.introPhase === 'hold') this.setState({ introPulse: true });
    }, 4500);
    this.introFallbackTO = window.setTimeout(() => {
      if (this.state.introPhase === 'hold') this.beginBreakApart();
    }, 9000);
  };

  private beginBreakApart = () => {
    clearTimeout(this.introFallbackTO);
    clearTimeout(this.introPulseTO);
    const basePieces = this.state.pieces;
    if (!basePieces.length) {
      this.setState({ introPhase: null, introPulse: false });
      return;
    }
    this.setState({ introPhase: 'breaking', introPulse: false });
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const totalDuration = basePieces.reduce(
      (m, p) => Math.max(m, p.staggerDelay + p.animDur),
      700,
    );
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const pieces = basePieces.map((p) => {
        const localT = Math.min(
          1,
          Math.max(0, (elapsed - p.staggerDelay) / p.animDur),
        );
        const e = ease(localT);
        return {
          ...p,
          curLeft: p.homeLeft + (p.scatterLeft - p.homeLeft) * e,
          curTop: p.homeTop + (p.scatterTop - p.homeTop) * e,
          rotation: p.scatterRotation * e,
        };
      });
      if (elapsed < totalDuration) {
        this.setState({ pieces });
        this.introRaf = requestAnimationFrame(tick);
      } else {
        this.setState({
          pieces: basePieces.map((p) => ({
            ...p,
            curLeft: p.scatterLeft,
            curTop: p.scatterTop,
            rotation: p.scatterRotation,
          })),
          introPhase: null,
          startTime: Date.now(),
          elapsedSec: 0,
        });
        if (this.state.mode === 'video' && this.videoEl) {
          try {
            void this.videoEl.play().catch(() => {});
          } catch {
            /* ignore */
          }
        }
      }
    };
    this.introRaf = requestAnimationFrame(tick);
  };

  private newGameClick = () =>
    this.newGame(this.state.rows, this.state.cols, this.state.difficulty);
  private setPieceCount = (n: number) => {
    const preset = PIECE_COUNT_PRESETS[n];
    if (preset) this.newGame(preset[0], preset[1], this.state.difficulty);
  };
  private setDifficulty = (d: Difficulty) =>
    this.newGame(this.state.rows, this.state.cols, d);

  /** Arm / disarm the $5 wager. Arm it before "New game" to lock this round's
   * par time; disarming mid-round just drops the bet with no settlement. */
  private toggleWager = () => {
    this.setState((s) => {
      const wagerActive = !s.wagerActive;
      const wagerParSec = wagerActive
        ? wagerParSeconds(s.rows * s.cols, s.difficulty)
        : 0;
      if (wagerActive) this.startWagerTicker(wagerParSec);
      else this.stopWagerTicker();
      return {
        wagerActive,
        wagerParSec,
        wagerResultNet: null,
        wagerElapsedSec: 0,
      };
    });
  };

  private startWagerTicker(parSec: number) {
    this.stopWagerTicker();
    const ms = wagerTickIntervalMs(parSec);
    if (ms <= 0) return;
    this.wagerTimer = window.setInterval(() => {
      this.setState((s) => {
        if (!s.wagerActive) return null;
        const elapsed = (Date.now() - s.startTime) / 1000;
        const pot = wagerPot(elapsed, s.wagerParSec);
        sound.wagerTick(wagerUrgency(pot));
        return { wagerElapsedSec: elapsed };
      });
    }, ms);
  }

  private stopWagerTicker() {
    if (this.wagerTimer != null) {
      clearInterval(this.wagerTimer);
      this.wagerTimer = undefined;
    }
  }
  // ---- piece mutation helpers -------------------------------

  private updatePiece(id: string, patch: Partial<Piece>) {
    this.setState((s) => ({
      pieces: s.pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  private groupSize(groupId: string) {
    return groupSizeOf(this.state.pieces, groupId);
  }

  private pulse(groupId: string, ms?: number) {
    clearTimeout(this.pulseTO);
    this.setState({ pulseGroupId: groupId });
    this.pulseTO = window.setTimeout(
      () => this.setState({ pulseGroupId: null }),
      ms || 320,
    );
  }

  /** Apply a connect/snap result: merge/lock pieces, play the click, glow, and
   * fire the win handler once every piece is solved. */
  private runConnectAndSnap = (groupId: string) => {
    const result = tryConnectAndSnap(
      groupId,
      this.state.pieces,
      this.state.difficulty,
      this.snapTol,
    );
    if (!result) return;
    sound.connect();
    this.setState(
      (s) => ({
        pieces: result.pieces,
        solvedCount: s.solvedCount + result.newlySolved,
      }),
      () => {
        if (
          this.state.pieces.length &&
          this.state.solvedCount === this.state.pieces.length
        ) {
          this.handleWin();
        }
      },
    );
    this.pulse(result.checkGroup, 320);
  };

  // ---- pointer drag ----------------------------------------

  private checkManualDoubleClick(id: string, e: React.SyntheticEvent) {
    const now = Date.now();
    const isDouble = this.lastDownId === id && now - this.lastDownTime < 380;
    this.lastDownId = isDouble ? null : id;
    this.lastDownTime = now;
    if (isDouble) {
      e.stopPropagation();
      this.onPieceDouble(id, e);
      return true;
    }
    return false;
  }

  private onPieceDown = (id: string, e: React.PointerEvent) => {
    if (this.state.introPhase) return;
    if (this.checkManualDoubleClick(id, e)) return;
    const p = this.state.pieces.find((pp) => pp.id === id);
    if (!p || p.solved) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const members = this.state.pieces.filter(
      (pp) => pp.groupId === p.groupId && !pp.solved,
    );
    this.drag = {
      groupId: p.groupId,
      startX: e.clientX,
      startY: e.clientY,
      anchorHomeLeft: p.homeLeft,
      anchorHomeTop: p.homeTop,
      anchorStartLeft: p.curLeft,
      anchorStartTop: p.curTop,
      memberIds: new Set(members.map((m) => m.id)),
    };
    this.setState({ selectedId: id, draggingGroupId: p.groupId });
  };

  private onPieceMove = (_id: string | null, e: React.PointerEvent) => {
    if (!this.drag) return;
    const scale = this.state.stageScale || 1;
    const dx = Math.round((e.clientX - this.drag.startX) / scale);
    const dy = Math.round((e.clientY - this.drag.startY) / scale);
    let { left: anchorLeft, top: anchorTop } = clampAnchor(
      this.state.pieces,
      this.drag.anchorStartLeft + dx,
      this.drag.anchorStartTop + dy,
      this.drag.memberIds,
      this.drag.anchorHomeLeft,
      this.drag.anchorHomeTop,
    );
    let moved = deriveClusterPositions(
      this.state.pieces,
      this.drag.memberIds,
      this.drag.anchorHomeLeft,
      this.drag.anchorHomeTop,
      anchorLeft,
      anchorTop,
    );
    const magnet = computeMagnetOffset(
      this.drag.groupId,
      moved,
      this.state.difficulty,
      this.magnetRadius,
    );
    let rotationPatch: number | null = null;
    if (magnet) {
      anchorLeft += Math.round(magnet.dx);
      anchorTop += Math.round(magnet.dy);
      moved = deriveClusterPositions(
        this.state.pieces,
        this.drag.memberIds,
        this.drag.anchorHomeLeft,
        this.drag.anchorHomeTop,
        anchorLeft,
        anchorTop,
      );
      if (this.drag.memberIds.size === 1 && this.state.difficulty === 'hard') {
        const p = moved.find((pp) => this.drag!.memberIds.has(pp.id));
        if (p) {
          const norm = ((p.rotation % 360) + 360) % 360;
          const delta = norm > 180 ? norm - 360 : norm;
          rotationPatch = p.rotation - delta * magnet.pull;
        }
      }
    }
    if (rotationPatch != null) {
      moved = moved.map((p) =>
        this.drag!.memberIds.has(p.id) ? { ...p, rotation: rotationPatch! } : p,
      );
    }
    this.setState({ pieces: moved });
  };

  private onPieceUp = (_id: string | null, _e: React.PointerEvent) => {
    if (!this.drag) return;
    const groupId = this.drag.groupId;
    this.drag = null;
    this.setState({ draggingGroupId: null });
    this.runConnectAndSnap(groupId);
  };

  // ---- rotation -------------------------------------------

  private rotateSelected90 = () => {
    if (this.state.introPhase) return;
    const id = this.state.selectedId;
    if (id == null) return;
    const p = this.state.pieces.find((pp) => pp.id === id);
    if (!p || p.solved) return;
    this.updatePiece(id, { rotation: (p.rotation + 90) % 360 });
    sound.tick();
    this.pulse(p.groupId, 220);
    setTimeout(() => this.runConnectAndSnap(p.groupId), 40);
  };

  private onRotateHandleDown = (e: React.PointerEvent) => {
    if (this.state.introPhase) return;
    const id = this.state.selectedId;
    if (id == null) return;
    const p = this.state.pieces.find((pp) => pp.id === id);
    if (!p) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    this.rotateDrag = {
      id,
      cx: p.curLeft + p.boxW / 2,
      cy: p.curTop + p.boxH / 2,
    };
  };
  private onRotateHandleMove = (e: React.PointerEvent) => {
    if (!this.rotateDrag || !this.stageEl) return;
    const { id, cx, cy } = this.rotateDrag;
    const rect = this.stageEl.getBoundingClientRect();
    const scale = this.state.stageScale || 1;
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    let ang = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI + 90;
    ang = ((ang % 360) + 360) % 360;
    this.updatePiece(id, { rotation: ang });
  };
  private onRotateHandleUp = () => {
    if (!this.rotateDrag) return;
    const id = this.rotateDrag.id;
    this.rotateDrag = null;
    const p = this.state.pieces.find((pp) => pp.id === id);
    this.runConnectAndSnap(p ? p.groupId : id);
  };

  // ---- misc controls ------------------------------------

  private toggleGhost = () => this.setState((s) => ({ showGhost: !s.showGhost }));
  private toggleTimerHidden = () =>
    this.setState((s) => ({ timerHidden: !s.timerHidden }));

  private deselect = (e: React.MouseEvent) => {
    if (this.state.introPhase === 'hold') {
      this.beginBreakApart();
      return;
    }
    if (e.target === e.currentTarget) this.setState({ selectedId: null });
  };

  private setBgColor = (hex: string) => this.setState({ bgColor: hex });

  private onPieceDouble = (id: string, e: React.SyntheticEvent) => {
    if (this.state.introPhase) return;
    e.stopPropagation();
    const p = this.state.pieces.find((pp) => pp.id === id);
    if (!p) return;
    const jitterX = (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 30);
    const jitterY = (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 30);
    if (p.solved) {
      const wasFullySolved =
        this.state.pieces.length > 0 &&
        this.state.solvedCount === this.state.pieces.length;
      if (wasFullySolved) {
        this.wonHandled = false;
        clearTimeout(this.statsTO);
      }
      this.setState((s) => ({
        pieces: s.pieces.map((pp) =>
          pp.id === id
            ? {
                ...pp,
                solved: false,
                groupId: id,
                curLeft: pp.curLeft + jitterX,
                curTop: pp.curTop + jitterY,
              }
            : pp,
        ),
        solvedCount: Math.max(0, s.solvedCount - 1),
        selectedId: id,
        showStatsCard: wasFullySolved ? false : s.showStatsCard,
      }));
      sound.tick();
    } else if (this.groupSize(p.groupId) > 1) {
      this.setState((s) => ({
        pieces: s.pieces.map((pp) =>
          pp.id === id
            ? {
                ...pp,
                groupId: id,
                curLeft: pp.curLeft + jitterX,
                curTop: pp.curTop + jitterY,
              }
            : pp,
        ),
        selectedId: id,
      }));
      sound.tick();
    }
  };

  private triggerHint = () => {
    const unsolved = this.state.pieces.filter((p) => !p.solved);
    if (!unsolved.length) return;
    const target = this.state.selectedId
      ? unsolved.find((p) => p.id === this.state.selectedId)
      : null;
    const pick =
      target || unsolved[Math.floor(Math.random() * unsolved.length)];
    this.setState({ hintPieceId: pick.id, selectedId: pick.id });
    clearTimeout(this.hintTO);
    this.hintTO = window.setTimeout(
      () => this.setState({ hintPieceId: null }),
      1700,
    );
  };

  private formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ---- render ------------------------------------------

  render() {
    const s = this.state;
    const isVideoMode = s.mode === 'video';
    const isImageMode = !isVideoMode;
    const activePreset =
      BG_PRESETS.find((b) => b.hex === s.bgColor) || BG_PRESETS[0];
    const pageBg = bgCssFor(activePreset.hex, 260);
    const isWon = s.pieces.length > 0 && s.solvedCount === s.pieces.length;

    const difficultyLabel = {
      easy: 'Easy · No rotation',
      moderate: 'Moderate · Snap 90°',
      hard: 'Hard · Free rotate',
    }[s.difficulty];
    const helpText = {
      easy: 'Drag pieces into place — no rotation needed. Double-click a placed piece to pull it back apart.',
      moderate:
        'Select a piece, then tap the rotate button to turn it 90° at a time. Double-click a placed piece to pull it back apart.',
      hard: 'Select a piece, then drag its handle to spin it freely into place. Double-click a placed piece to pull it back apart.',
    }[s.difficulty];

    const pieceViews = this.buildPieceViews();
    const handle = this.buildRotateHandle();
    const hintRect = this.buildHintRect();

    const bestTimes = isWon ? bestTimesFor(s) : [];

    // live wager pot — replaces the time chip while a bet is in play. Reads
    // wagerElapsedSec (updated by the dedicated nickel ticker), not the
    // once-per-second elapsedSec, so it moves at the real payout cadence.
    const wagerPotNow = s.wagerActive
      ? wagerPot(s.wagerElapsedSec, s.wagerParSec)
      : 0;
    const wagerLost = s.wagerActive && wagerPotNow <= 0;

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#100e0c',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: '#f2ede6',
          padding: '20px 16px 60px',
          boxSizing: 'border-box',
        }}
      >
        <span
          onClick={this.props.onDevReset}
          title="Dev: reset welcome flow"
          style={{
            position: 'fixed',
            left: 8,
            bottom: 8,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.06)',
            cursor: 'pointer',
            zIndex: 5000,
          }}
        />

        {s.showResumePrompt && s.pendingResume && (
          <ResumePrompt
            summary={this.resumeSummary(s.pendingResume)}
            onResume={this.resumeGame}
            onStartNew={this.startFreshFromPrompt}
          />
        )}

        <Toolbar
          difficultyLabel={difficultyLabel}
          rows={s.rows}
          cols={s.cols}
          difficulty={s.difficulty}
          contentType={s.contentType}
          videoSrc={s.videoSrc}
          bgColor={s.bgColor}
          showGhost={s.showGhost}
          timerHidden={s.timerHidden}
          timeLabel={this.formatTime(s.elapsedSec)}
          solvedCount={s.solvedCount}
          totalPieces={s.pieces.length}
          currentImageLabel={labelForSrc('static', s.imageSrc)}
          hintAvailable={s.pieces.some((p) => !p.solved)}
          wagerActive={s.wagerActive}
          wagerPot={wagerPotNow}
          wagerLost={wagerLost}
          wagerBalance={s.wagerBalance}
          wagerStake={WAGER_STAKE}
          onToggleWager={this.toggleWager}
          onShowWelcome={this.props.onShowWelcome}
          onSetContentType={this.setContentType}
          onSetPieceCount={this.setPieceCount}
          onSetDifficulty={this.setDifficulty}
          onToggleGhost={this.toggleGhost}
          onToggleTimerHidden={this.toggleTimerHidden}
          onTriggerHint={this.triggerHint}
          onNewGame={this.newGameClick}
          onToggleLibrary={this.toggleLibrary}
          onSelectVideo={this.selectVideo}
          onSetBgColor={this.setBgColor}
        />

        <div
          style={{
            fontSize: 12,
            color: '#6f6659',
            paddingBottom: 14,
            textAlign: 'center',
          }}
        >
          {helpText}
        </div>

        <div
          ref={this.setStageHostRef}
          style={{ width: '100%', maxWidth: 1120, margin: '0 auto' }}
        >
          <div
            style={{
              position: 'relative',
              width: STAGE_W * s.stageScale,
              height: STAGE_H * s.stageScale,
              background: pageBg,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              ref={this.setStageRef}
              data-testid="stage"
              onClick={this.deselect}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: STAGE_W,
                height: STAGE_H,
                transform: `scale(${s.stageScale})`,
                transformOrigin: 'top left',
              }}
            >
              {/* board outline */}
              <div
                style={{
                  position: 'absolute',
                  left: BOARD_OFFSET_X,
                  top: BOARD_OFFSET_Y,
                  width: BOARD_W,
                  height: BOARD_H,
                  border: `1px dashed ${activePreset.outline}`,
                  borderRadius: 4,
                  pointerEvents: 'none',
                }}
              />

              {s.showGhost && isImageMode && (
                <div
                  style={{
                    position: 'absolute',
                    left: BOARD_OFFSET_X,
                    top: BOARD_OFFSET_Y,
                    width: BOARD_W,
                    height: BOARD_H,
                    borderRadius: 4,
                    backgroundImage: `url('${s.imageSrc}')`,
                    backgroundSize: `${BOARD_W}px ${BOARD_H}px`,
                    backgroundPosition: 'center',
                    opacity: 0.32,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {s.showGhost && isVideoMode && (
                <video
                  ref={this.setGhostVideoRef}
                  muted
                  loop
                  playsInline
                  autoPlay
                  style={{
                    position: 'absolute',
                    left: BOARD_OFFSET_X,
                    top: BOARD_OFFSET_Y,
                    width: BOARD_W,
                    height: BOARD_H,
                    borderRadius: 4,
                    objectFit: 'cover',
                    opacity: 0.32,
                    pointerEvents: 'none',
                  }}
                />
              )}

              {hintRect && (
                <div
                  style={{
                    position: 'absolute',
                    left: hintRect.left,
                    top: hintRect.top,
                    width: hintRect.w,
                    height: hintRect.h,
                    border: '2px solid #3fae7d',
                    borderRadius: 8,
                    boxShadow: '0 0 22px rgba(63,174,125,.6)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {isImageMode &&
  pieceViews.map((pv) => {
    // Faux-thickness edge: a solid cardboard-colored copy of
    // the same shape, scaled up slightly so it peeks out
    // evenly on every side as a rim. This is a flat color with
    // NO filter — cheap to paint — unlike a drop-shadow-based
    // outline, which forced the browser to rasterize+blur
    // every piece's silhouette on every interaction and caused
    // real click lag at higher piece counts.
    const rimPx = pv.lifted ? 2 : 1;
    const rimColor = pv.lifted ? '#b8a98c' : '#cfc3a8';
    const rimScale =
      1 + (rimPx * 2) / Math.max(pv.w, pv.h, 1);
    return (
      <div
        key={pv.id}
        style={{
          position: 'absolute',
          left: pv.left,
          top: pv.top,
          width: pv.w,
          height: pv.h,
          transform: pv.transform,
          zIndex: pv.z,
          transition: pv.transition,
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${rimScale})`,
            clipPath: `path('${pv.clip}')`,
            WebkitClipPath: `path('${pv.clip}')`,
            background: rimColor,
            transition: 'transform .12s ease-out',
            pointerEvents: 'none',
          }}
        />
        <div
          data-piece-id={pv.id}
          onPointerDown={pv.onDown}
          onPointerMove={pv.onMove}
          onPointerUp={pv.onUp}
          onDoubleClick={pv.onDouble}
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `path('${pv.clip}')`,
            WebkitClipPath: `path('${pv.clip}')`,
            backgroundImage: `url('${s.imageSrc}')`,
            backgroundSize: `${BOARD_W}px ${BOARD_H}px`,
            backgroundPosition: `${pv.bgX}px ${pv.bgY}px`,
            cursor: pv.cursor,
            boxShadow: pv.shadow,
            filter: pv.filter,
            touchAction: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `path('${pv.clip}')`,
            WebkitClipPath: `path('${pv.clip}')`,
            background:
              'linear-gradient(135deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,.35) 100%)',
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  })}

              {isVideoMode && (
                <>
                  <video
                    ref={this.setVideoRef}
                    muted
                    loop
                    playsInline
                    autoPlay
                    style={{
                      position: 'absolute',
                      width: 2,
                      height: 2,
                      opacity: 0,
                      pointerEvents: 'none',
                    }}
                  />
                  <canvas
                    ref={this.setCanvasRef}
                    width={STAGE_W}
                    height={STAGE_H}
                    onPointerDown={this.canvasPointerDown}
                    onPointerMove={this.canvasPointerMove}
                    onPointerUp={this.canvasPointerUp}
                    onDoubleClick={this.canvasDoubleClick}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: STAGE_W,
                      height: STAGE_H,
                      cursor: s.draggingGroupId != null ? 'grabbing' : 'grab',
                      touchAction: 'none',
                    }}
                  />
                </>
              )}

              {s.introPulse && (
                <div
                  style={{
                    position: 'absolute',
                    left: BOARD_OFFSET_X,
                    top: BOARD_OFFSET_Y,
                    width: BOARD_W,
                    height: BOARD_H,
                    borderRadius: 4,
                    boxShadow:
                      '0 0 0 2px rgba(0,82,255,.4), 0 0 46px rgba(0,82,255,.4)',
                    pointerEvents: 'none',
                    zIndex: 50,
                    opacity: 0,
                    animation: 'introNudgeGlow 1.8s ease-in-out infinite',
                  }}
                />
              )}

              {handle && (
                <div
                  data-testid="rotate-handle"
                  onClick={handle.isButton ? handle.onClick : undefined}
                  onPointerDown={handle.isDrag ? handle.onDown : undefined}
                  onPointerMove={handle.isDrag ? handle.onMove : undefined}
                  onPointerUp={handle.isDrag ? handle.onUp : undefined}
                  style={{
                    position: 'absolute',
                    left: handle.left,
                    top: handle.top,
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: '#3fae7d',
                    color: '#100e0c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: handle.isDrag ? 'grab' : 'pointer',
                    boxShadow: '0 6px 16px rgba(0,0,0,.5)',
                    zIndex: 900,
                    touchAction: 'none',
                  }}
                >
                  <RotateIcon />
                </div>
              )}

              {isWon && (
                <WinOverlay
                  isImageMode={isImageMode}
                  imageSrc={s.imageSrc}
                  timeLabel={this.formatTime(s.elapsedSec)}
                  bestTimes={bestTimes}
                  currentTime={s.elapsedSec}
                  showStatsCard={s.showStatsCard}
                  configKey={configKey(s)}
                  wagerResultNet={s.wagerResultNet}
                  setRevealVideoRef={this.setRevealVideoRef}
                  onPlayAgain={this.newGameClick}
                />
              )}
            </div>
          </div>
        </div>

        {s.libraryOpen && (
          <ImageLibraryModal
            groups={imagesByCategory()}
            currentSrc={s.imageSrc}
            canAccess={(tier) => canAccess(tier)}
            onPick={this.selectImage}
            onClose={this.toggleLibrary}
          />
        )}
      </div>
    );
  }

  // ---- render helpers -------------------------------------

  private resumeSummary(pr: SavedProgress) {
    const diffLbl =
      { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' }[pr.difficulty] ||
      pr.difficulty;
    return `${pr.rows * pr.cols} pieces · ${diffLbl} · ${this.formatTime(
      pr.elapsedSec,
    )} elapsed`;
  }

  private buildHintRect() {
    const s = this.state;
    if (s.hintPieceId == null) return null;
    const p = s.pieces.find((pp) => pp.id === s.hintPieceId);
    if (!p) return null;
    return { left: p.homeLeft, top: p.homeTop, w: p.boxW, h: p.boxH };
  }

  private buildRotateHandle() {
    const s = this.state;
    if (s.selectedId == null) return null;
    const p = s.pieces.find((pp) => pp.id === s.selectedId);
    if (!p || p.solved || s.difficulty === 'easy' || this.groupSize(p.groupId) !== 1)
      return null;
    const left = p.curLeft + p.boxW / 2 - 17;
    const top = p.curTop - 34;
    if (s.difficulty === 'moderate') {
      return {
        isButton: true as const,
        isDrag: false as const,
        left,
        top,
        onClick: this.rotateSelected90,
      };
    }
    return {
      isButton: false as const,
      isDrag: true as const,
      left,
      top,
      onDown: this.onRotateHandleDown,
      onMove: this.onRotateHandleMove,
      onUp: this.onRotateHandleUp,
    };
  }

  /** Per-piece view model for image mode — the equivalent of the prototype's
   * `renderVals().pieces` map, including the intro-phase branches. */
  private buildPieceViews() {
    const s = this.state;
    return s.pieces.map((p): PieceView => {
      if (s.introPhase === 'hold') {
        return {
          id: p.id,
          left: p.homeLeft,
          top: p.homeTop,
          clip: p.pathD,
          bgX: p.bgPosX,
          bgY: p.bgPosY,
          w: p.boxW,
          h: p.boxH,
          transform: `rotate(0deg) scale(${BLEED})`,
          cursor: 'default',
          z: 1,
          shadow: 'none',
          filter: 'none',
          transition: 'none',
          lifted: false,
          onDown: NOOP,
          onMove: NOOP,
          onUp: NOOP,
          onDouble: NOOP,
        };
      }
      if (s.introPhase === 'breaking') {
        return {
          id: p.id,
          left: p.curLeft,
          top: p.curTop,
          clip: p.pathD,
          bgX: p.bgPosX,
          bgY: p.bgPosY,
          w: p.boxW,
          h: p.boxH,
          transform: `rotate(${p.rotation}deg) scale(${BLEED})`,
          cursor: 'default',
          z: 300,
          shadow: 'none',
          filter: 'drop-shadow(0 9px 14px rgba(0,0,0,.5))',
          transition: 'none',
          lifted: false,
          onDown: NOOP,
          onMove: NOOP,
          onUp: NOOP,
          onDouble: NOOP,
        };
      }
      const isDragging =
        s.draggingGroupId != null && p.groupId === s.draggingGroupId && !p.solved;
      const isPulsing =
        !isDragging &&
        s.pulseGroupId != null &&
        p.groupId === s.pulseGroupId &&
        !p.solved;
      const isHinted = !isDragging && s.hintPieceId === p.id && !p.solved;
      const isClustered = !isDragging && this.groupSize(p.groupId) > 1;
      const scale = isDragging ? 1.09 : isPulsing ? 1.07 : isHinted ? 1.05 : 1;
      const lift = isDragging ? -6 : 0;
      let shadow = 'none';
      if (isPulsing) shadow = '0 0 0 3px rgba(63,174,125,.85)';
      else if (isHinted)
        shadow = '0 0 0 3px rgba(63,174,125,.95), 0 0 26px rgba(63,174,125,.75)';
      let filter = 'none';
      if (!p.solved) {
        if (isDragging) filter = 'drop-shadow(0 18px 20px rgba(0,0,0,.55))';
        else if (!isClustered) filter = 'drop-shadow(0 3px 4px rgba(0,0,0,.3))';
      }
      let transition = 'none';
      if (isDragging)
        transition = 'left .07s ease-out, top .07s ease-out, transform .12s ease-out';
      else if (p.solved || isPulsing || isHinted)
        transition =
          'left .2s cubic-bezier(.22,1,.36,1), top .2s cubic-bezier(.22,1,.36,1), transform .22s cubic-bezier(.34,1.56,.64,1), filter .2s ease';
      return {
        id: p.id,
        left: p.curLeft,
        top: p.curTop + lift,
        clip: p.pathD,
        bgX: p.bgPosX,
        bgY: p.bgPosY,
        w: p.boxW,
        h: p.boxH,
        transform: `rotate(${p.rotation}deg) scale(${scale * BLEED})`,
        cursor: p.solved ? 'default' : isDragging ? 'grabbing' : 'grab',
        z: p.solved
          ? 1
          : isDragging
            ? 999
            : isHinted
              ? 700
              : p.id === s.selectedId
                ? 600
                : 200,
        shadow,
        filter,
        transition,
        lifted: isDragging,
        onDown: (e) => this.onPieceDown(p.id, e),
        onMove: (e) => this.onPieceMove(p.id, e),
        onUp: (e) => this.onPieceUp(p.id, e),
        onDouble: (e) => this.onPieceDouble(p.id, e),
      };
    });
  }
}

const NOOP = () => {};

interface PieceView {
  id: string;
  left: number;
  top: number;
  clip: string;
  bgX: number;
  bgY: number;
  w: number;
  h: number;
  transform: string;
  cursor: string;
  z: number;
  shadow: string;
  filter: string;
  transition: string;
    /** true while the piece is picked up (drag start fires on pointerdown, so
   * this is also "selected") — widens the faux-thickness edge underneath it. */
  lifted: boolean;
  onDown: (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: (e: React.PointerEvent) => void;
  onDouble: (e: React.SyntheticEvent) => void;
}

function RotateIcon() {
  const st: CSSProperties = { display: 'block' };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={st}
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}
