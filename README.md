# Get2 Jigsaw

A web jigsaw puzzle where the pieces **rotate** — rotation is the difficulty
differentiator. Classic (static image) and Live (looping video) puzzles across
three difficulty tiers, plus the first-launch marketing/overview experience, in
one codebase.

Rebuilt from the Claude Design prototype (`_prototype/Jigsaw Board.dc.html`) — a
functional reference implementation, not just a mock. The engine here is a
faithful port of that prototype's logic.

## Stack

- **Vite 6** + **React 18** + **TypeScript** (strict)
- No game framework — the puzzle is an imperative class component driving DOM
  clip-paths (Classic) or a single `<canvas>` (Live).
- Persistence: `localStorage` only. No accounts, no backend, no sync (by design).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  → dist/
npm run preview    # serve the build
npm run typecheck
```

Node ≥ 20 (developed on 22.23.2). If `node` isn't on your PATH but was
installed to `~/.local/node`, that's wired into `~/.zshenv`.

## Layout

```
src/
  App.tsx                     first-launch overview  ↔  game switch
  game/
    constants.ts              stage/board geometry, presets, brand tokens
    types.ts
    geometry.ts               shared edge table + piece-shape generation
    snap.ts                   magnetic snap, cluster merge, connect/solve
    sound.ts                  Web Audio SFX (no files)
    persistence.ts            best times + resume, all localStorage
    JigsawGame.tsx            the engine (port of the prototype's Component)
  components/
    Toolbar / ResumePrompt / ImageLibraryModal / WinOverlay
    welcome/                  Hero, LiveRow, RotationDemo, CuratedGrid, Pricing
  content/
    library.ts               curated image + Live clip manifest
    tiers.ts                  Free / Premium gating (Premium = waitlist only)
scripts/
  gen-placeholders.mjs        regenerates the stand-in art (see ASSETS.md)
public/uploads/               art + media (placeholders today)
_prototype/                   the original .dc.html files, for reference
```

## Core mechanic notes (why the code looks the way it does)

- **Shared edge geometry.** Each interior edge's tab/notch is generated once
  (`hEdge` / `vEdge` tables) and referenced by both neighbouring cells, so
  adjacent pieces always interlock. `buildEdge` is direction-symmetric.
  `src/game/geometry.ts`.
- **Difficulty = rotation.** Easy: no rotation. Moderate: 90° steps with a
  spring bounce (`rotateSelected90`). Hard: free drag-to-rotate
  (`onRotateHandle*`). `isRotationOk` sets the per-tier tolerance.
- **Snap.** A dragged group is eased toward a valid home/neighbour within
  `magnetRadius`; on release, `tryConnectAndSnap` merges matching groups and
  locks a cluster solved when it's home + upright. Click + blue glow + sound.
- **All layout math is relative to the 1120×760 stage element**, never the
  viewport; the stage is uniformly scaled to its host via `ResizeObserver`.
- **Piece bounding box** is padded `min(cellW,cellH) * 0.4` so tab bulges are
  never clipped and solved pieces leave no gaps. A `BLEED` scale of 1.014
  closes sub-pixel seams.
- **Looping animations gather back** — the hero and the rotation demo reverse
  their scatter with mirrored easing rather than hard-cutting.

See `ASSETS.md` for what's real vs placeholder.
