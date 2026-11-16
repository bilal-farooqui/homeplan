// Furniture catalogue: real-world sizes in metres + modelled pieces (rounded upholstery, panelled joinery, leaf-card plants).
// Local frame: +z is the front of the piece, -z is its back (against a wall), y is up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { worldUV } from './batch.js';

// [width, depth, height, collides]
export const SIZES = {
  bed: (o) => [o.w ?? 1.6, 2.1, 1.05],
  bedside: () => [0.45, 0.4, 0.5],
  wardrobe: (o) => [o.w ?? 1.8, 0.6, 2.2],
  dresser: (o) => [o.w ?? 1.2, 0.45, 0.8],
  desk: (o) => [o.w ?? 1.2, 0.55, 0.75],
  chair: () => [0.45, 0.45, 0.85],
  sofa: (o) => [o.w ?? 2.1, 0.9, 0.85],
  armchair: () => [0.85, 0.85, 0.85],
  coffee: (o) => [o.w ?? 1.1, 0.6, 0.4],
  tvunit: (o) => [o.w ?? 1.8, 0.4, 1.2],
  dining: (o) => [o.w ?? 1.2, 1.7, 0.85],
  counter: (o) => [o.w ?? 0.6, 0.6, 0.9],
  fridge: () => [0.7, 0.7, 1.75],
  wallcab: (o) => [o.w ?? 0.8, 0.33, 2.2, false],
  wc: () => [0.4, 0.7, 0.8],
  basin: () => [0.5, 0.45, 0.9],
  shower: () => [0.8, 0.8, 2.0],
  mirror: (o) => [o.w ?? 0.5, 0.03, 1.9, false],
  plant: () => [0.4, 0.4, 1.2],
  planter: (o) => [o.w ?? 1.0, 0.4, 1.1],
  shoe: (o) => [o.w ?? 0.9, 0.35, 1.0],
  console: (o) => [o.w ?? 1.0, 0.35, 0.8],
  rug: (o) => [o.w ?? 2, o.d ?? 1.4, 0.01, false],
  art: (o) => [o.w ?? 1.0, 0.04, 0.6, false],
  loungechair: () => [0.82, 0.82, 0.95],
  succulent: () => [0.2, 0.2, 0.2, false],
};

export const sizeOf = (item) => {
  const s = (SIZES[item.type] || (() => [0.5, 0.5, 0.5]))(item);
  return [s[0], s[1], s[2], s[3] !== false];
};

const ROT = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };

// small seeded random so every build is identical
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// a cloud of leaf cards inside an ellipsoid (plants, vases)
function leaves(F, M, cx, cy, cz, rx, ry, rz, n, size, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, k = Math.sqrt(1 - u * u);
    const px = cx + rx * k * Math.cos(a) * (0.4 + 0.6 * r());
    const pz = cz + rz * k * Math.sin(a) * (0.4 + 0.6 * r());
    const py = cy + ry * u * (0.4 + 0.6 * r());
    F.quad(r() > 0.5 ? M.leafCard : M.leafCard2, px, py, pz, size * (0.5 + 0.2 * r()), size * (0.8 + 0.4 * r()), r() * Math.PI * 2, -0.9 + r() * 1.1);
  }
}

// ---- builders --------------------------------------------------------------
const B = {
  loungechair() {}, // the leather lounge chair model is placed by assets.js
  succulent() {},
  bed(F, M, o) {
    const w = o.w ?? 1.6, d = 2.1;
    F.rbox(M.woodDark, 0, 0.17, 0, w, 0.34, d, 0.02);
    F.rbox(M.white, 0, 0.43, 0.03, w - 0.04, 0.2, d - 0.1, 0.06);
    F.rbox(M.blanket, 0, 0.56, 0.3, w + 0.0, 0.1, 1.28, 0.05); // duvet
    F.rbox(M.blanket, 0, 0.5, 0.92, w + 0.02, 0.2, 0.1, 0.04); // fold over the foot
    F.rbox(M.accent, 0, 0.625, 0.62, w * 0.92, 0.03, 0.36, 0.015); // runner
    for (const s of [-1, 1]) F.rbox(M.white, s * w * 0.25, 0.64, -d / 2 + 0.32, w * 0.42, 0.15, 0.42, 0.07, [-0.25, 0, 0]);
    F.rbox(M.white, 0, 0.72, -d / 2 + 0.2, w * 0.4, 0.14, 0.34, 0.07, [-0.9, 0, 0]);
    F.rbox(M.woodDark, 0, 0.62, -d / 2 + 0.04, w + 0.1, 0.96, 0.08, 0.025);
    F.rbox(M.fabric2, 0, 0.72, -d / 2 + 0.095, w - 0.12, 0.66, 0.05, 0.05);
  },
  bedside(F, M) {
    F.rbox(M.wood, 0, 0.25, 0, 0.45, 0.5, 0.4, 0.015);
    F.box(M.woodDark, 0, 0.36, 0.201, 0.38, 0.012, 0.006);
    F.sph(M.steel, 0, 0.3, 0.215, 0.015);
    F.cyl(M.white, 0.08, 0.53, -0.05, 0.05, 0.05, 0.05);
    F.cyl(M.lampShade, 0.08, 0.68, -0.05, 0.1, 0.14, 0.2);
  },
  wardrobe(F, M, o) {
    const w = o.w ?? 1.8;
    F.box(M.wood, 0, 1.1, 0, w, 2.2, 0.6);
    F.box(M.woodDark, 0, 0.04, 0.31, w, 0.08, 0.02); // plinth
    F.box(M.woodDark, 0, 2.2, 0.0, w + 0.04, 0.05, 0.64); // top moulding
    const n = Math.max(2, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w * i) / n + 0.02, x1 = -w / 2 + (w * (i + 1)) / n - 0.02;
      F.rbox(M.woodPanel, (x0 + x1) / 2, 1.1, 0.305, x1 - x0, 2.06, 0.02, 0.008);
      F.box(M.steel, i % 2 ? x0 + 0.05 : x1 - 0.05, 1.05, 0.325, 0.014, 0.28, 0.02);
    }
  },
  dresser(F, M, o) {
    const w = o.w ?? 1.2;
    F.rbox(M.wood, 0, 0.4, 0, w, 0.8, 0.45, 0.015);
    for (const y of [0.17, 0.4, 0.63]) {
      F.rbox(M.woodPanel, 0, y, 0.225, w - 0.1, 0.2, 0.012, 0.006);
      F.box(M.steel, 0, y, 0.24, 0.16, 0.012, 0.012);
    }
    F.cyl(M.white, w * 0.3, 0.9, 0, 0.05, 0.07, 0.2);
    leaves(F, M, w * 0.3, 1.1, 0, 0.07, 0.1, 0.07, 6, 0.12, 7);
  },
  desk(F, M, o) {
    const w = o.w ?? 1.2;
    F.rbox(M.wood, 0, 0.73, 0, w, 0.04, 0.55, 0.012);
    F.rbox(M.woodDark, -w / 2 + 0.03, 0.36, 0, 0.04, 0.72, 0.5, 0.01);
    F.rbox(M.woodDark, w / 2 - 0.03, 0.36, 0, 0.04, 0.72, 0.5, 0.01);
    F.rbox(M.black, 0, 0.95, -0.1, 0.5, 0.3, 0.02, 0.01); // monitor
    F.box(M.black, 0, 0.8, -0.1, 0.05, 0.08, 0.05);
    F.rbox(M.black, 0.0, 0.76, 0.12, 0.4, 0.015, 0.14, 0.006); // keyboard
  },
  chair(F, M) {
    F.rbox(M.fabric2, 0, 0.45, 0, 0.45, 0.07, 0.45, 0.03);
    F.rbox(M.fabric2, 0, 0.74, -0.2, 0.44, 0.5, 0.05, 0.03, [0.08, 0, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.cyl(M.woodDark, sx * 0.19, 0.21, sz * 0.19, 0.016, 0.014, 0.42);
  },
  sofa(F, M, o) {
    const w = o.w ?? 2.1;
    F.rbox(M.fabric1, 0, 0.2, 0, w, 0.34, 0.9, 0.05);
    const n = w > 1.9 ? 3 : 2;
    const cw = (w - 0.34) / n;
    for (let i = 0; i < n; i++) F.rbox(M.fabric1b, -((w - 0.34) / 2) + cw * (i + 0.5), 0.43, 0.09, cw - 0.015, 0.16, 0.66, 0.07); // seat cushions
    for (let i = 0; i < n; i++) F.rbox(M.fabric1, -((w - 0.34) / 2) + cw * (i + 0.5), 0.68, -0.27, cw - 0.015, 0.46, 0.2, 0.08, [-0.12, 0, 0]); // back cushions
    F.rbox(M.fabric1, 0, 0.55, -0.4, w, 0.7, 0.14, 0.06);
    for (const s of [-1, 1]) F.rbox(M.fabric1, s * (w / 2 - 0.09), 0.5, 0.0, 0.18, 0.46, 0.9, 0.08); // arms
    for (const [s, c] of [[-1, M.accent], [1, M.fabric2]]) F.rbox(c, s * (w / 2 - 0.42), 0.68, 0.02, 0.4, 0.38, 0.12, 0.07, [-0.2, s * 0.3, 0]);
    for (const sx of [-1, 1]) F.cyl(M.woodDark, sx * (w / 2 - 0.08), 0.03, 0.34, 0.02, 0.02, 0.06);
    for (const sx of [-1, 1]) F.cyl(M.woodDark, sx * (w / 2 - 0.08), 0.03, -0.34, 0.02, 0.02, 0.06);
  },
  armchair(F, M) {
    F.rbox(M.fabric2, 0, 0.2, 0, 0.85, 0.34, 0.85, 0.06);
    F.rbox(M.fabric2b, 0, 0.43, 0.08, 0.5, 0.15, 0.62, 0.07);
    F.rbox(M.fabric2, 0, 0.62, -0.34, 0.85, 0.5, 0.17, 0.08, [-0.1, 0, 0]);
    for (const s of [-1, 1]) F.rbox(M.fabric2, s * 0.36, 0.48, 0.02, 0.15, 0.4, 0.82, 0.07);
    F.rbox(M.accent, 0.12, 0.66, -0.05, 0.36, 0.34, 0.11, 0.06, [-0.2, 0.2, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.cyl(M.woodDark, sx * 0.34, 0.03, sz * 0.34, 0.02, 0.016, 0.07);
  },
  coffee(F, M, o) {
    const w = o.w ?? 1.1;
    F.rbox(M.woodDark, 0, 0.38, 0, w, 0.04, 0.6, 0.015);
    F.rbox(M.wood, 0, 0.2, 0, w - 0.12, 0.025, 0.48, 0.01);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.cyl(M.steel, sx * (w / 2 - 0.06), 0.19, sz * 0.25, 0.014, 0.014, 0.38);
  },
  tvunit(F, M, o) {
    const w = o.w ?? 1.8;
    F.rbox(M.woodDark, 0, 0.25, 0, w, 0.5, 0.4, 0.02);
    for (let i = 0; i < 3; i++) F.rbox(M.wood, -w / 3 + (w / 3) * i, 0.25, 0.205, w / 3 - 0.06, 0.38, 0.01, 0.005);
    F.box(M.black, 0, 0.82, -0.08, w * 0.68, 0.62, 0.035);
    F.box(M.screen, 0, 0.82, -0.06, w * 0.68 - 0.03, 0.59, 0.004);
    F.box(M.black, 0, 0.53, -0.08, 0.28, 0.04, 0.12);
    F.rbox(M.black, w * 0.3, 0.535, 0.08, 0.3, 0.05, 0.1, 0.012); // set-top box
  },
  dining(F, M, o) {
    const w = o.w ?? 1.2;
    F.rbox(M.wood, 0, 0.74, 0, w, 0.045, 0.8, 0.015);
    F.rbox(M.glassTop, 0, 0.77, 0, w - 0.06, 0.012, 0.74, 0.004);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.cyl(M.woodDark, sx * (w / 2 - 0.07), 0.36, sz * 0.33, 0.03, 0.022, 0.72);
    for (const sx of [-0.28, 0.28]) {
      F.sub(sx, -0.62, 0, B.chair);
      F.sub(sx, 0.62, Math.PI, B.chair);
    }
  },
  counter(F, M, o) {
    const w = o.w ?? 0.6;
    F.box(M.cabinet, 0, 0.42, 0, w, 0.84, 0.6);
    F.box(M.black, 0, 0.05, 0.02, w - 0.02, 0.1, 0.56);
    const n = Math.max(1, Math.round(w / 0.45));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w * i) / n + 0.012, x1 = -w / 2 + (w * (i + 1)) / n - 0.012;
      F.rbox(M.cabinetDoor, (x0 + x1) / 2, 0.47, 0.303, x1 - x0, 0.68, 0.018, 0.006);
      F.box(M.steel, (x0 + x1) / 2, 0.75, 0.322, Math.min(0.2, x1 - x0 - 0.06), 0.012, 0.014);
    }
    F.rbox(M.counterTop, 0, 0.87, 0.01, w + 0.01, 0.04, 0.62, 0.008);
    if (o.hob) {
      F.rbox(M.black, 0, 0.895, 0, 0.56, 0.012, 0.48, 0.006);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        F.cyl(M.steelDark, sx * 0.14, 0.905, sz * 0.12, 0.075, 0.075, 0.006);
        F.cyl(M.black, sx * 0.14, 0.909, sz * 0.12, 0.035, 0.035, 0.006);
      }
      F.rbox(M.steel, 0, 1.6, -0.12, 0.6, 0.1, 0.38, 0.03);
      F.box(M.steel, 0, 2.3, -0.24, 0.26, 1.4, 0.14);
    }
    if (o.sink) {
      F.rbox(M.steelDark, 0, 0.88, 0.02, w - 0.18, 0.04, 0.4, 0.04);
      F.cyl(M.steel, 0, 1.0, -0.2, 0.012, 0.012, 0.22);
      F.cyl(M.steel, 0, 1.12, -0.1, 0.009, 0.009, 0.2).__rot = true;
    }
  },
  fridge(F, M) {
    F.rbox(M.steel, 0, 0.875, 0, 0.7, 1.75, 0.7, 0.025);
    F.box(M.steelDark, 0, 1.12, 0.351, 0.68, 0.012, 0.005);
    F.rbox(M.black, 0.28, 1.4, 0.37, 0.02, 0.4, 0.03, 0.008);
    F.rbox(M.black, 0.28, 0.85, 0.37, 0.02, 0.3, 0.03, 0.008);
  },
  wallcab(F, M, o) {
    const w = o.w ?? 0.8;
    F.box(M.cabinet, 0, 1.78, 0, w, 0.7, 0.33);
    const n = Math.max(1, Math.round(w / 0.45));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w * i) / n + 0.012, x1 = -w / 2 + (w * (i + 1)) / n - 0.012;
      F.rbox(M.cabinetDoor, (x0 + x1) / 2, 1.78, 0.168, x1 - x0, 0.66, 0.014, 0.006);
      F.box(M.steel, (x0 + x1) / 2, 1.47, 0.18, 0.12, 0.012, 0.012);
    }
  },
  wc(F, M) {
    F.rbox(M.ceramic, 0, 0.62, -0.28, 0.38, 0.4, 0.16, 0.04);
    F.rbox(M.steel, 0.0, 0.84, -0.28, 0.1, 0.02, 0.06, 0.01); // flush button
    F.ell(M.ceramic, 0, 0.26, 0.04, 0.17, 0.2, 0.31);
    F.ell(M.ceramic, 0, 0.42, 0.06, 0.19, 0.03, 0.33);
    F.box(M.ceramic, 0, 0.2, -0.17, 0.2, 0.4, 0.2);
  },
  basin(F, M) {
    F.rbox(M.cabinet, 0, 0.38, 0, 0.5, 0.74, 0.45, 0.015);
    F.rbox(M.counterTop, 0, 0.77, 0, 0.52, 0.04, 0.47, 0.01);
    F.ell(M.ceramic, 0, 0.84, 0.03, 0.19, 0.08, 0.16);
    F.cyl(M.steel, 0, 0.95, -0.15, 0.012, 0.012, 0.22);
    F.cyl(M.steel, 0, 1.05, -0.07, 0.009, 0.009, 0.1);
  },
  mirror(F, M, o) {
    const w = o.w ?? 0.5;
    F.rbox(M.steel, 0, 1.5, 0, w + 0.04, 0.84, 0.02, 0.01);
    F.box(M.mirror, 0, 1.5, 0.012, w, 0.8, 0.005);
  },
  shower(F, M) {
    F.rbox(M.ceramic, 0, 0.03, 0, 0.8, 0.06, 0.8, 0.02);
    F.box(M.glassPane, 0, 1.0, 0.395, 0.8, 1.9, 0.01);
    F.box(M.glassPane, 0.395, 1.0, 0, 0.01, 1.9, 0.8);
    F.box(M.steel, 0, 0.1, 0.4, 0.8, 0.02, 0.02);
    F.cyl(M.steel, 0, 1.2, -0.37, 0.012, 0.012, 2.0);
    F.cyl(M.steel, 0, 2.0, -0.28, 0.08, 0.08, 0.02);
    F.box(M.steel, 0, 2.0, -0.32, 0.02, 0.02, 0.1);
  },
  plant(F, M) {
    F.cyl(M.pot, 0, 0.2, 0, 0.18, 0.12, 0.4);
    F.cyl(M.soil, 0, 0.395, 0, 0.16, 0.16, 0.02);
    for (let i = 0; i < 5; i++) F.cyl(M.stem, Math.cos(i * 1.3) * 0.06, 0.65, Math.sin(i * 1.3) * 0.06, 0.006, 0.01, 0.5);
    leaves(F, M, 0, 0.82, 0, 0.26, 0.32, 0.26, 70, 0.2, 11);
  },
  planter(F, M, o) {
    const w = o.w ?? 1.0;
    F.rbox(M.woodDark, 0, 0.2, 0, w, 0.4, 0.4, 0.02);
    F.box(M.soil, 0, 0.405, 0, w - 0.04, 0.01, 0.36);
    leaves(F, M, 0, 0.7, 0, w / 2 - 0.1, 0.3, 0.14, 100, 0.2, 21);
  },
  shoe(F, M, o) {
    const w = o.w ?? 0.9;
    F.rbox(M.woodDark, 0, 0.5, 0, w, 1.0, 0.35, 0.015);
    for (const y of [0.25, 0.5, 0.75]) {
      F.rbox(M.wood, 0, y, 0.176, w - 0.08, 0.2, 0.008, 0.004);
      F.box(M.steel, 0, y + 0.07, 0.188, 0.1, 0.01, 0.01);
    }
  },
  console(F, M, o) {
    const w = o.w ?? 1.0;
    F.rbox(M.wood, 0, 0.74, 0, w, 0.04, 0.35, 0.012);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.cyl(M.woodDark, sx * (w / 2 - 0.05), 0.36, sz * 0.14, 0.02, 0.016, 0.72);
    F.cyl(M.white, 0.2, 0.9, 0, 0.055, 0.075, 0.24);
    for (let i = 0; i < 3; i++) F.cyl(M.stem, 0.2 + (i - 1) * 0.02, 1.15, 0, 0.004, 0.004, 0.3);
    leaves(F, M, 0.2, 1.22, 0, 0.1, 0.12, 0.1, 18, 0.12, 31);
    F.rbox(M.artA, -0.25, 0.8, 0.0, 0.18, 0.09, 0.14, 0.02); // small tray / books
  },
  rug(F, M, o) {
    F.rbox(M.rugBorder, 0, 0.006, 0, o.w ?? 2, 0.012, o.d ?? 1.4, 0.004);
    F.rbox(M[o.color] || M.rugA, 0, 0.011, 0, (o.w ?? 2) - 0.18, 0.012, (o.d ?? 1.4) - 0.18, 0.004);
  },
  art(F, M, o) {
    const w = o.w ?? 1.0, h = o.h ?? 0.7, y = o.hy ?? 1.6; // o.y is the plan position, so the mounting height is hy
    F.box(M.artFrame, 0, y, 0.02, w, h, 0.035);
    F.box(M.white, 0, y, 0.039, w - 0.05, h - 0.05, 0.004);
    F.box(M[o.color] || M.artA, 0, y, 0.043, w - 0.14, h - 0.14, 0.006);
    F.box(M.artB, -w * 0.18, y + 0.05, 0.048, w * 0.3, h * 0.3, 0.004);
    F.box(M.white, w * 0.15, y - 0.08, 0.048, w * 0.4, h * 0.2, 0.004);
  },
};

export function buildFurniture(items, M, batch) {
  for (const item of items) {
    const build = B[item.type];
    if (!build) continue;
    const rot = ROT[item.face || 'S'];
    const base = new THREE.Matrix4().makeRotationY(rot).setPosition(item.x, 0, item.y);
    build(makeCtx(base, batch, M), M, item);
  }
}

function makeCtx(base, batch, M) {
  const place = (g, uv = true) => {
    g.applyMatrix4(base);
    batch.add(g.__mat, uv ? worldUV(g) : g);
  };
  const F = {
    box(mat, cx, cy, cz, sx, sy, sz) {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      g.translate(cx, cy, cz);
      g.applyMatrix4(base);
      batch.add(mat, worldUV(g));
    },
    rbox(mat, cx, cy, cz, sx, sy, sz, r = 0.03, rot) {
      const rr = Math.max(0.002, Math.min(r, sx / 2 - 1e-3, sy / 2 - 1e-3, sz / 2 - 1e-3));
      const g = new RoundedBoxGeometry(sx, sy, sz, 3, rr);
      if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); }
      g.translate(cx, cy, cz);
      g.applyMatrix4(base);
      batch.add(mat, worldUV(g));
    },
    cyl(mat, cx, cy, cz, rt, rb, h) {
      const g = new THREE.CylinderGeometry(rt, rb, h, 12);
      g.translate(cx, cy, cz);
      g.applyMatrix4(base);
      batch.add(mat, worldUV(g));
      return g;
    },
    sph(mat, cx, cy, cz, r) {
      const g = new THREE.SphereGeometry(r, 8, 6);
      g.translate(cx, cy, cz);
      g.applyMatrix4(base);
      batch.add(mat, worldUV(g));
    },
    ell(mat, cx, cy, cz, rx, ry, rz) {
      const g = new THREE.SphereGeometry(1, 14, 10);
      g.scale(rx, ry, rz);
      g.translate(cx, cy, cz);
      g.applyMatrix4(base);
      batch.add(mat, worldUV(g));
    },
    // a flat card (leaf), its base at (cx, cy, cz), tilted back by rx and turned by ry
    quad(mat, cx, cy, cz, w, h, ry, rx) {
      const g = new THREE.PlaneGeometry(w, h);
      g.translate(0, h / 2, 0);
      g.rotateX(rx);
      g.rotateY(ry);
      g.translate(cx, cy, cz);
      g.applyMatrix4(base);
      batch.add(mat, g);
    },
    sub(x, z, rotY, fn) {
      const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, 0, z);
      fn(makeCtx(base.clone().multiply(m), batch, M), M);
    },
  };
  void place;
  return F;
}
