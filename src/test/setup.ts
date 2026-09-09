/**
 * jsdom test environment shims. jsdom has no rAF scheduler that advances on its
 * own, no ResizeObserver, no Web Audio, and no canvas 2d context — none of which
 * the image-mode drag/snap/solve path actually needs, so we stub them just
 * enough to let the component mount and its animation frames flush.
 */
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* noop */
  }
});

// rAF → run on a macrotask so recursive rAF loops (intro scatter, draw loop)
// make progress and eventually settle instead of hanging.
let rafId = 0;
const rafCbs = new Map<number, FrameRequestCallback>();
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  const id = ++rafId;
  rafCbs.set(id, cb);
  setTimeout(() => {
    if (rafCbs.delete(id)) cb(performance.now());
  }, 0);
  return id;
});
vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  rafCbs.delete(id);
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// Web Audio — sound.ts wraps every call in try/catch, so a throwing stub is
// fine; we just need the constructor to exist.
class AudioContextStub {
  currentTime = 0;
  destination = {};
  state = 'running';
  createOscillator() {
    return {
      type: '',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {
        return this;
      },
      start() {},
      stop() {},
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {
        return this;
      },
    };
  }
  createBiquadFilter() {
    return {
      type: '',
      frequency: { value: 0 },
      Q: { value: 0 },
      connect() {
        return this;
      },
    };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(8) };
  }
  createBufferSource() {
    return {
      buffer: null,
      connect() {
        return this;
      },
      start() {},
      stop() {},
    };
  }
  resume() {
    return Promise.resolve();
  }
}
vi.stubGlobal('AudioContext', AudioContextStub);

if (!('PointerEvent' in globalThis)) {
  // jsdom ships PointerEvent in recent versions; guard just in case.
  class PointerEventStub extends MouseEvent {
    pointerId: number;
    constructor(type: string, props: PointerEventInit = {}) {
      super(type, props);
      this.pointerId = props.pointerId ?? 1;
    }
  }
  vi.stubGlobal('PointerEvent', PointerEventStub);
}

// jsdom elements lack these; the drag code calls them on the piece element.
if (!Element.prototype.setPointerCapture)
  Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture)
  Element.prototype.releasePointerCapture = () => {};

// HTMLMediaElement.play is unimplemented in jsdom.
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: () => Promise.resolve(),
});
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: () => {},
});
Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: () => {},
});
