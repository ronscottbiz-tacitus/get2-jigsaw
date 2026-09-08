# Assets

All curated content is now **real** (dropped in 2026-09-08):

| Asset | Path | Notes |
|---|---|---|
| Get2 logo | `public/uploads/get2-logo.png` | 600×346 |
| 12 curated images — full | `public/uploads/puzzle-library/full/puz_<key>.jpg` | re-encoded to ≤2200px, q86 (~0.8–1.7 MB each) |
| 12 curated images — thumbs | `public/uploads/puzzle-library/thumbs/puz_<key>.jpg` | 600×335, ~50–96 KB |
| 5 Live posters | `public/uploads/puzzle-library/posters/poster_<key>.jpg` | re-encoded to real JPEG ≤1920px, q82 (~230–480 KB) |
| 5 Live clips | `public/uploads/<key>.mp4` | `clouds_2`, `balloons`, `fire`, `murmuration`, `jellyfish`; 1.8–3.9 MB |
| Board texture | `public/uploads/textures/brushed-metal-grain.png.svg` | still a generated placeholder |

`src/content/library.ts` has `IMG_EXT = 'jpg'`.

## Optimization note

The dropped posters were 1.8–9.5 MB PNGs saved with a `.jpg` extension (the
jellyfish one drives the marketing hero). They were re-encoded in place to real
JPEGs — **25.7 MB → 1.6 MB total** — and the full images trimmed from ~21 MB to
~14 MB. Un-touched originals are backed up under
`public/uploads/_originals/` (git-ignored); delete that folder once you're happy.

Regenerate optimized versions from a fresh drop with:

```bash
sips -s format jpeg -s formatOptions 82 -Z 1920 <src> --out <dest>   # posters
sips -s format jpeg -s formatOptions 86 -Z 2200 <src> --out <dest>   # full images
```

## Placeholder generator

`scripts/gen-placeholders.mjs` still exists — it writes gradient `.svg`
stand-ins. Only needed if you add library keys before their real art exists;
set `IMG_EXT = 'svg'` to use them.

## Still a placeholder

- **Board texture** — `TEXTURE_URL` in `src/game/constants.ts` points at the SVG.
  Swap in a tileable `brushed-metal-grain.png` and update the constant.

## Library size

12 images (2 per category) + 5 Live clips. Target is 30–50 images — add rows to
`IMAGES` in `src/content/library.ts` and drop matching files in.
