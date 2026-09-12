/**
 * Procedural sound effects, ported verbatim from the prototype. Everything is
 * synthesised with the Web Audio API — no audio files. A single lazily-created
 * AudioContext is shared; every call is wrapped so a blocked/again-suspended
 * context can never throw into game logic. `navigator.vibrate` is fired
 * alongside each sound where supported.
 */
class SoundKit {
  private ctx: AudioContext | null = null;
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private ac(): AudioContext {
    // Every call site already wraps `ac()` in try/catch and treats a throw
    // as "audio unavailable" — muting just gives it another true reason to
    // land there, with no change needed to any of the methods below.
    if (this.muted) throw new Error('sound muted');
    if (!this.ctx) {
      const Ctx: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
    }
    // A user gesture may be needed before the context leaves "suspended".
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private vibrate(pattern: number | number[]) {
    if (this.muted) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* not supported */
    }
  }

  /** Soft downward blip — piece selected / rotated one step / pulled apart. */
  tick() {
    try {
      const ctx = this.ac();
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(520, now);
      o.frequency.exponentialRampToValueAtTime(300, now + 0.06);
      g.gain.setValueAtTime(0.16, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      o.connect(g).connect(ctx.destination);
      o.start(now);
      o.stop(now + 0.14);
    } catch {
      /* audio unavailable */
    }
    this.vibrate(12);
  }

  /** The "click" of a correct connection: a bandpassed noise burst (broadband
   * impact, not a tone) plus a short low triangle thump underneath. */
  connect() {
    try {
      const ctx = this.ac();
      const now = ctx.currentTime;
      const dur = 0.012;
      const frameCount = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, frameCount, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 3500;
      bandpass.Q.value = 1.2;
      const gNoise = ctx.createGain();
      gNoise.gain.setValueAtTime(0.9, now);
      gNoise.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(bandpass).connect(gNoise).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + dur);
      noise.onended = () => {
        try {
          noise.disconnect();
          bandpass.disconnect();
          gNoise.disconnect();
        } catch {
          /* already gone */
        }
      };
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(160, now);
      o2.frequency.exponentialRampToValueAtTime(70, now + 0.045);
      g2.gain.setValueAtTime(0.001, now);
      g2.gain.linearRampToValueAtTime(0.28, now + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      o2.connect(g2).connect(ctx.destination);
      o2.start(now);
      o2.stop(now + 0.06);
      o2.onended = () => {
        try {
          o2.disconnect();
          g2.disconnect();
        } catch {
          /* already gone */
        }
      };
    } catch {
      /* audio unavailable */
    }
    this.vibrate([0, 10, 28, 16]);
  }

  /** Two-note rising sine — a whole cluster locked home. */
  solve() {
    try {
      const ctx = this.ac();
      const now = ctx.currentTime;
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(660, now);
      g1.gain.setValueAtTime(0.001, now);
      g1.gain.setValueAtTime(0.24, now + 0.005);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      o1.connect(g1).connect(ctx.destination);
      o1.start(now);
      o1.stop(now + 0.11);
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(990, now + 0.08);
      g2.gain.setValueAtTime(0.001, now + 0.08);
      g2.gain.setValueAtTime(0.24, now + 0.09);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      o2.connect(g2).connect(ctx.destination);
      o2.start(now + 0.08);
      o2.stop(now + 0.25);
    } catch {
      /* audio unavailable */
    }
    this.vibrate([0, 25]);
  }

  /** Four-note arpeggio with sub-octave — the puzzle is complete. */
  winChime() {
    try {
      const ctx = this.ac();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const t = now + i * 0.09;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.95);
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(freq / 2, t);
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.linearRampToValueAtTime(0.08, t + 0.03);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        o2.connect(g2).connect(ctx.destination);
        o2.start(t);
        o2.stop(t + 0.85);
      });
    } catch {
      /* audio unavailable */
    }
    this.vibrate([0, 20, 40, 20, 40, 30]);
  }

  /**
   * Periodic countdown blip while a wager round is live. `intensity` runs 0
   * (pot full, $10) → 1 (pot empty, $0); it raises the pitch and volume and
   * shortens each blip, so the ticking audibly tightens as the pot drains.
   */
  wagerTick(intensity = 0) {
    const k = Math.min(1, Math.max(0, intensity));
    try {
      const ctx = this.ac();
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(430 + k * 690, now); // ~430 → ~1120 Hz
      const vol = 0.035 + k * 0.11; // ~0.035 → ~0.15
      const dur = 0.055 - k * 0.025; // ~0.055 → ~0.03 s
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g).connect(ctx.destination);
      o.start(now);
      o.stop(now + dur + 0.02);
    } catch {
      /* audio unavailable */
    }
    this.vibrate(k > 0.7 ? 9 : 4);
  }

  /** Bright rising triad — the wager round netted a win. */
  wagerWin() {
    try {
      const ctx = this.ac();
      const now = ctx.currentTime;
      [523.25, 659.25, 987.77].forEach((freq, i) => {
        const t = now + i * 0.07;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.2, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.4);
      });
    } catch {
      /* audio unavailable */
    }
    this.vibrate([0, 18, 26, 22]);
  }

  /** Low descending buzz — the wager round netted a loss. */
  wagerLoss() {
    try {
      const ctx = this.ac();
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(240, now);
      o.frequency.exponentialRampToValueAtTime(85, now + 0.5);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.17, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      o.connect(g).connect(ctx.destination);
      o.start(now);
      o.stop(now + 0.6);
    } catch {
      /* audio unavailable */
    }
    this.vibrate([0, 45, 60, 45]);
  }
}

export const sound = new SoundKit();
