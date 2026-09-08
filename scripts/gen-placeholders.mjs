/**
 * Generates lightweight SVG stand-ins for the curated library so the app is
 * runnable before the real assets exist. Each file is self-contained (fixed
 * width/height, no external refs) so it works both as a CSS background-image
 * and as a source for canvas drawImage() in Live mode.
 *
 * Replace with real assets by dropping files with the SAME names into
 * public/uploads/... and flipping IMG_EXT / VIDEO handling in
 * src/content/library.ts. Run: `node scripts/gen-placeholders.mjs`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/uploads');

/** [key, name, [c1, c2, c3], motif] per category. */
const IMAGES = [
  ['mountain-valley', 'Mountain Valley', ['#1e3a5f', '#4a7fa5', '#a9d0e8'], 'ridges'],
  ['autumn-canopy', 'Autumn Canopy', ['#3d1f0a', '#a5471b', '#e8a13c'], 'leaves'],
  ['fox', 'Fox', ['#2a1206', '#b5541c', '#f0b271'], 'fur'],
  ['snow-leopard', 'Snow Leopard', ['#2b2f3a', '#7b8494', '#dfe4ec'], 'spots'],
  ['cityscape', 'Cityscape', ['#0d1a2b', '#274b73', '#8fb7dd'], 'towers'],
  ['courtyard', 'Courtyard', ['#241c12', '#7a5c38', '#d8c197'], 'arches'],
  ['nebula', 'Nebula', ['#170a2b', '#5b1e7a', '#c451a8'], 'stars'],
  ['solar-sys', 'Solar System', ['#05070f', '#1c2f5b', '#e8b84b'], 'orbits'],
  ['abstract-swirl', 'Abstract Swirl', ['#0a2622', '#1f7a6b', '#7fe0c9'], 'swirl'],
  ['mosaic', 'Mosaic', ['#2b0f1f', '#8a2f5c', '#e6a3c4'], 'tiles'],
  ['botanicals', 'Botanicals', ['#0f2410', '#3f7a3f', '#a9d99b'], 'fronds'],
  ['poppies', 'Poppies', ['#2a0606', '#a01b1b', '#f2896f'], 'blooms'],
];

const VIDEOS = [
  ['clouds', 'Clouds', ['#20364d', '#5f86ab', '#d7e6f2']],
  ['balloons', 'Balloons', ['#123a52', '#3f7fae', '#f2c14e']],
  ['fire', 'Fire', ['#1c0a04', '#a3350f', '#f2b134']],
  ['murmuration', 'Murmuration', ['#241f2b', '#5a5570', '#c9c3d8']],
  ['jellyfish', 'Jellyfish', ['#050a1f', '#123a6b', '#4fd0e0']],
];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1000) / 1000;
  };
}

function motif(kind, w, h, seed) {
  const r = rng(seed);
  const parts = [];
  if (kind === 'stars' || kind === 'orbits') {
    for (let i = 0; i < 90; i++)
      parts.push(
        `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(r() * 2 + 0.4).toFixed(2)}" fill="#fff" opacity="${(r() * 0.7 + 0.1).toFixed(2)}"/>`,
      );
    if (kind === 'orbits')
      for (let i = 1; i <= 4; i++)
        parts.push(
          `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${i * w * 0.12}" ry="${i * h * 0.08}" fill="none" stroke="#fff" stroke-opacity="0.18"/>`,
        );
  } else if (kind === 'swirl' || kind === 'blooms' || kind === 'fronds') {
    for (let i = 0; i < 8; i++) {
      const cx = r() * w;
      const cy = r() * h;
      const rr = r() * w * 0.28 + 40;
      parts.push(
        `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rr.toFixed(0)}" fill="#fff" opacity="${(r() * 0.08 + 0.03).toFixed(3)}"/>`,
      );
    }
  } else {
    // banded terrain / towers / tiles feel
    const bands = 7;
    for (let i = 0; i < bands; i++) {
      const y = (h / bands) * i + r() * 20;
      parts.push(
        `<rect x="-20" y="${y.toFixed(0)}" width="${w + 40}" height="${(h / bands + 30).toFixed(0)}" fill="#000" opacity="${(0.04 + i * 0.02).toFixed(3)}"/>`,
      );
    }
  }
  return parts.join('');
}

function svg(w, h, name, colors, kind, seed, showLabel) {
  const [c1, c2, c3] = colors;
  const label = showLabel
    ? `<text x="${w * 0.06}" y="${h - h * 0.08}" font-family="'Archivo Expanded','Arial Narrow',sans-serif" font-weight="800" font-size="${Math.round(h * 0.09)}" fill="#fff" fill-opacity="0.9">${name}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/>
</linearGradient>
<radialGradient id="h" cx="0.3" cy="0.25" r="0.9">
<stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
${motif(kind, w, h, seed)}
<rect width="${w}" height="${h}" fill="url(#h)"/>
${label}
</svg>`;
}

function write(path, content) {
  const full = resolve(OUT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return path;
}

const written = [];
for (const [key, name, colors, kind] of IMAGES) {
  const seed = hash(key);
  written.push(
    write(`puzzle-library/full/puz_${key}.svg`, svg(1200, 800, name, colors, kind, seed, false)),
  );
  written.push(
    write(`puzzle-library/thumbs/puz_${key}.svg`, svg(420, 280, name, colors, kind, seed, true)),
  );
}
for (const [key, name, colors] of VIDEOS) {
  const seed = hash(key);
  written.push(
    write(`puzzle-library/posters/poster_${key}.svg`, svg(1200, 800, name, colors, 'stars', seed, true)),
  );
}

// brushed-metal board texture — a tiny tileable noise field.
const tr = rng(99);
const lines = [];
for (let i = 0; i < 60; i++) {
  const y = tr() * 40;
  lines.push(
    `<line x1="0" y1="${y.toFixed(2)}" x2="40" y2="${(y + (tr() - 0.5) * 2).toFixed(2)}" stroke="#000" stroke-opacity="${(tr() * 0.05).toFixed(3)}"/>`,
  );
  lines.push(
    `<line x1="0" y1="${y.toFixed(2)}" x2="40" y2="${(y + (tr() - 0.5) * 2).toFixed(2)}" stroke="#fff" stroke-opacity="${(tr() * 0.04).toFixed(3)}"/>`,
  );
}
written.push(
  write(
    'textures/brushed-metal-grain.png.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${lines.join('')}</svg>`,
  ),
);

console.log(`wrote ${written.length} placeholder assets under public/uploads/`);
for (const w of written) console.log('  ' + w);
