// Checks the floor plan data without a browser:
//  - furniture overlapping walls / each other
//  - tight gaps (0.03 - 0.60 m) between furniture and walls
//  - furniture blocking door or window zones
//  - every walkable room reachable from the entrance by a person (0.22 m radius)
import fs from 'node:fs';
import { computeLayout, rectOfFurniture, collisionRects } from '../src/layout.js';
import { sizeOf } from '../src/furniture.js';

const file = process.argv[2] || 'floorplan.json';
const plan = JSON.parse(fs.readFileSync(new URL('../src/data/' + file, import.meta.url)));
console.log('checking', file);
const layout = computeLayout(plan);
const fr = plan.furniture
  .map((it, i) => ({ it, i, s: sizeOf(it) }))
  .map((o) => ({ ...o, r: rectOfFurniture(o.it, o.s) }));
const solid = fr.filter((o) => o.s[3]);
const structure = collisionRects(layout, []);
let errors = 0, warns = 0;
import { roomAt } from '../src/layout.js';
const sameRoom = (a, b) => roomAt(plan, a.it.x, a.it.y)?.id === roomAt(plan, b.it.x, b.it.y)?.id;
const sets = [['bed', 'bedside'], ['desk', 'chair'], ['coffee', 'sofa'], ['coffee', 'armchair'], ['coffee', 'tvunit'], ['counter', 'counter'], ['counter', 'fridge'], ['wc', 'basin'], ['wc', 'shower'], ['basin', 'shower'], ['basin', 'mirror']];
const pair = (a, b) => sets.some(([x, y]) => (a.it.type === x && b.it.type === y) || (a.it.type === y && b.it.type === x));
const name = (o) => `${o.it.type}@(${o.it.x},${o.it.y})`;
const overlap = (a, b, m = 0) => a.x0 < b.x1 - m && a.x1 > b.x0 + m && a.z0 < b.z1 - m && a.z1 > b.z0 + m;
const gap = (a, b) => {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0);
  const dz = Math.max(a.z0 - b.z1, b.z0 - a.z1, 0);
  return Math.hypot(dx, dz);
};

for (const o of solid) {
  for (const s of structure) if (overlap(o.r, s, 0.005)) { console.log('ERROR overlaps structure:', name(o), 'with wall', s.wall || s.item || ''); errors++; }
  for (const p of solid) if (p.i > o.i && overlap(o.r, p.r, 0.005)) { console.log('ERROR overlaps furniture:', name(o), 'with', name(p)); errors++; }
}
for (const o of solid) {
  for (const p of solid) if (p.i > o.i && sameRoom(o, p) && !pair(o, p)) { const g = gap(o.r, p.r); if (g > 0.03 && g < 0.6) { console.log(`warn gap ${g.toFixed(2)} m:`, name(o), '<->', name(p)); warns++; } }
}
// door / window zones
for (const op of layout.openings) {
  const h = op.horiz;
  const mk = (n0, n1) => (h ? { x0: op.s0, x1: op.s1, z0: n0, z1: n1 } : { x0: n0, x1: n1, z0: op.s0, z1: op.s1 });
  if (op.kind !== 'window' && !(op.kind === 'sliding' && !op.open)) {
    for (const side of [-1, 1]) {
      const zone = mk(side > 0 ? op.c + op.t / 2 : op.c - op.t / 2 - 0.9, side > 0 ? op.c + op.t / 2 + 0.9 : op.c - op.t / 2);
      for (const o of solid) if (overlap(o.r, zone, 0.01)) { console.log('ERROR blocks doorway:', name(o), 'at', op.wall); errors++; }
    }
  } else {
    const zone = mk(op.c - op.t / 2 - 0.45, op.c + op.t / 2 + 0.45);
    for (const o of fr) if (overlap(o.r, zone, 0.01) && o.s[2] > op.sill && o.it.type !== 'rug' && o.it.type !== 'mirror') { console.log('warn tall item near window:', name(o), 'at', op.wall, `(h ${o.s[2]} > sill ${op.sill})`); warns++; }
  }
}

// reachability on a 5 cm grid, eroded by the player radius
const cell = 0.05, R = 0.22;
const fp = plan.footprint, ox = fp.x0 ?? 0, oz = fp.z0 ?? 0;
const sp = plan.validateStart || plan.start;
const gw = Math.ceil(((fp.x1 ?? fp.width) - ox) / cell), gd = Math.ceil((Math.max(fp.z1 ?? fp.depth, sp.y + 1) - oz) / cell);
const all = collisionRects(layout, solid.map((o) => o.r));
const blocked = new Uint8Array(gw * gd);
for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) {
  const x = ox + (i + 0.5) * cell, z = oz + (j + 0.5) * cell;
  for (const r of all) {
    const cx = Math.max(r.x0, Math.min(x, r.x1)), cz = Math.max(r.z0, Math.min(z, r.z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < R * R) { blocked[j * gw + i] = 1; break; }
  }
}
const seen = new Uint8Array(gw * gd);
const si = Math.floor((sp.x - ox) / cell), sj = Math.floor((sp.y - oz) / cell);
const q = [sj * gw + si]; seen[q[0]] = 1;
for (let h = 0; h < q.length; h++) {
  const c = q[h], i = c % gw, j = (c / gw) | 0;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= gw || nj >= gd) continue;
    const n = nj * gw + ni;
    if (!seen[n] && !blocked[n]) { seen[n] = 1; q.push(n); }
  }
}
for (const r of plan.rooms) {
  if (r.walkable === false || r.noFloor || r.open && r.id === 'duct') continue;
  let tot = 0, ok = 0;
  for (const rc of r.rects) for (let z = rc[1] + 0.2; z < rc[3] - 0.2; z += cell) for (let x = rc[0] + 0.2; x < rc[2] - 0.2; x += cell) {
    const ci = Math.floor((x - ox) / cell), cj = Math.floor((z - oz) / cell);
    if (ci < 0 || cj < 0 || ci >= gw || cj >= gd) continue;
    const c = cj * gw + ci;
    if (blocked[c]) continue;
    tot++; if (seen[c]) ok++;
  }
  const flag = ok === 0 ? 'UNREACHABLE' : ok < tot ? 'partly reachable' : 'ok';
  if (ok === 0) errors++;
  console.log(`room ${r.id.padEnd(10)} ${r.name.padEnd(16)} free cells ${tot}, reachable ${ok} -> ${flag}`);
}
console.log(`\n${errors} errors, ${warns} warnings`);
process.exit(errors ? 1 : 0);
