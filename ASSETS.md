# Assets — real vs placeholder

Only the **Get2 logo** is a real asset. Everything else under `public/uploads/`
is a generated stand-in from `scripts/gen-placeholders.mjs` (run
`node scripts/gen-placeholders.mjs` to regenerate).

| Asset | Status | Path | Replace with |
|---|---|---|---|
| Get2 logo | ✅ real | `public/uploads/get2-logo.png` | — |
| 12 curated images (full + thumb) | ⛔ placeholder `.svg` | `public/uploads/puzzle-library/{full,thumbs}/puz_<key>.svg` | Google AI Studio originals, `.jpg` |
| 5 Live posters | ⛔ placeholder `.svg` | `public/uploads/puzzle-library/posters/poster_<key>.svg` | still frame from each clip, `.jpg` |
| 5 Live clips | ⛔ missing | `public/uploads/<key>.mp4` | Morph Studio image-to-video, `.mp4` |
| Board texture | ⛔ placeholder `.svg` | `public/uploads/textures/brushed-metal-grain.png.svg` | tileable brushed-metal `.png` |

## Dropping in the real assets

1. **Images** — put the real files at the same paths with `.jpg` extension, then
   set `IMG_EXT = 'jpg'` in `src/content/library.ts`. SVG placeholders can stay;
   they're ignored once the extension flips.
2. **Live clips** — drop `clouds_2.mp4`, `balloons.mp4`, `fire.mp4`,
   `murmuration.mp4`, `jellyfish.mp4` into `public/uploads/`. No code change —
   `JigsawGame` uses the real video the moment it loads and drops the animated
   fallback fill. (The prototype's filenames are kept: note `clouds_2.mp4`, not
   `clouds.mp4`.)
3. **Texture** — add `brushed-metal-grain.png` and point `TEXTURE_URL` in
   `src/game/constants.ts` at it.

## Placeholder behaviour today

- **Classic** puzzles use the gradient SVGs — fully playable, the picture is
  just abstract.
- **Live** puzzles: with no `.mp4`, `JigsawGame.paintFallbackSlice` fills each
  piece with a slow-drifting gradient field so the mechanic still reads as
  "moving". Marketing Live tiles show the poster with a light sheen.
- The hero backdrop uses the jellyfish **poster** as a still until
  `jellyfish.mp4` exists (then swap the `<div>` backdrop in
  `src/components/welcome/Hero.tsx` for a `<video>`).

## Library size

The manifest currently has the **12** images named in the prototype (2 per
category) + the **5** Live clips. Target is 30–50 images — add rows to `IMAGES`
in `src/content/library.ts` and a matching entry in `scripts/gen-placeholders.mjs`
(or just drop real files in). Confirm with Ron which of the 12 names are real
curated originals vs. demo stand-ins.
