import * as THREE from 'three';
import { computeLayout, rectOfFurniture, collisionRects, roomAt } from './layout.js';
import { buildFurniture, sizeOf } from './furniture.js';
import { Batch, boxGeo } from './batch.js';
import { buildExterior } from './exterior.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export const FLOOR_H = 3.3; // first-floor level minus ground-floor level

// UVs in world metres (so tile textures keep their real size on any piece)
function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getZ(i)) > 0.5) uv.setXY(i, p.getX(i), p.getY(i));
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, p.getZ(i), p.getY(i));
    else uv.setXY(i, p.getX(i), p.getZ(i));
  }
  return g;
}

function subtractRects(r, holes) {
  let out = [r];
  for (const h of holes) {
    const next = [];
    for (const q of out) {
      const ix0 = Math.max(q[0], h[0]), iz0 = Math.max(q[1], h[1]), ix1 = Math.min(q[2], h[2]), iz1 = Math.min(q[3], h[3]);
      if (ix0 >= ix1 || iz0 >= iz1) { next.push(q); continue; }
      if (q[1] < iz0) next.push([q[0], q[1], q[2], iz0]);
      if (iz1 < q[3]) next.push([q[0], iz1, q[2], q[3]]);
      if (q[0] < ix0) next.push([q[0], iz0, ix0, iz1]);
      if (ix1 < q[2]) next.push([ix1, iz0, q[2], iz1]);
    }
    out = next;
  }
  return out;
}

// Builds one storey. Everything is built at y = 0 inside a group that is then lifted by yOff.
function buildFloor(plan, M, { yOff, f0, f1, isFirst }) {
  const H = plan.ceilingHeight;
  const fp = plan.footprint;
  const layout = computeLayout(plan);

  const group = new THREE.Group();
  const ceilGroup = new THREE.Group();
  group.position.y = yOff;
  ceilGroup.position.y = yOff;

  // ---- walls, blocks, columns, frames, leaves
  const wb = new Batch();
  for (const s of layout.solids) if (!s.diag) wb.add(M.wall, boxGeo(s)); // angled walls are drawn separately (their small squares are collision only)
  for (const b of layout.blocks) wb.add(M.wall, boxGeo(b));
  for (const sl of layout.slabs) {
    const top = 0.035, over = 0.035;
    wb.add(M.wall, boxGeo({ ...sl, y1: sl.y1 - top }));
    wb.add(M.marble, boxGeo({ x0: sl.x0 - over, x1: sl.x1 + over, z0: sl.z0, z1: sl.z1 + over, y0: sl.y1 - top, y1: sl.y1 })); // marble slab, overhanging the open sides
  }
  for (const c of layout.columns) wb.add(M.column, boxGeo(c));
  // angled walls get their own mesh that does not receive the static shadow map (it shows banding on slanted faces)
  const diagBatch = new Batch();
  for (const d of layout.diagSegs) {
    const g = new THREE.BoxGeometry(d.len, H, d.t);
    g.rotateY(d.angle);
    g.translate(d.cx, H / 2, d.cz);
    diagBatch.add(M.wall, g);
  }
  diagBatch.flush(group, { cast: true, receive: false });
  for (const f of layout.frames) wb.add(f.mat === 'alu' ? M.alu : M.doorWood, boxGeo(f));
  const gl = new Batch();
  for (const l of layout.leaves) {
    if (!l.glass) {
      wb.add(M.doorWood, boxGeo(l));
      const lz = l.x1 - l.x0 < l.z1 - l.z0; // leaf runs along z
      const lo = lz ? l.z0 : l.x0, hi = lz ? l.z1 : l.x1;
      for (const [y0, y1] of [[0.25, 1.0], [1.15, 1.95]]) {
        for (const side of [0, 1]) {
          const e0 = side ? 0.0 : -0.008, e1 = side ? 0.008 : 0.0;
          wb.add(M.doorPanel, boxGeo(lz
            ? { x0: (side ? l.x1 : l.x0) + e0, x1: (side ? l.x1 : l.x0) + e1, z0: lo + 0.12, z1: hi - 0.12, y0, y1 }
            : { z0: (side ? l.z1 : l.z0) + e0, z1: (side ? l.z1 : l.z0) + e1, x0: lo + 0.12, x1: hi - 0.12, y0, y1 }));
        }
      }
      continue;
    }
    const alongZ = l.x1 - l.x0 < l.z1 - l.z0;
    const bar = 0.05;
    if (alongZ) {
      wb.add(M.alu, boxGeo({ ...l, z1: l.z0 + bar })); wb.add(M.alu, boxGeo({ ...l, z0: l.z1 - bar }));
      wb.add(M.alu, boxGeo({ ...l, y1: l.y0 + bar })); wb.add(M.alu, boxGeo({ ...l, y0: l.y1 - bar }));
      gl.add(M.glass, boxGeo({ ...l, z0: l.z0 + bar, z1: l.z1 - bar, y0: l.y0 + bar, y1: l.y1 - bar, x0: (l.x0 + l.x1) / 2 - 0.006, x1: (l.x0 + l.x1) / 2 + 0.006 }));
    } else {
      wb.add(M.alu, boxGeo({ ...l, x1: l.x0 + bar })); wb.add(M.alu, boxGeo({ ...l, x0: l.x1 - bar }));
      wb.add(M.alu, boxGeo({ ...l, y1: l.y0 + bar })); wb.add(M.alu, boxGeo({ ...l, y0: l.y1 - bar }));
      gl.add(M.glass, boxGeo({ ...l, x0: l.x0 + bar, x1: l.x1 - bar, y0: l.y0 + bar, y1: l.y1 - bar, z0: (l.z0 + l.z1) / 2 - 0.006, z1: (l.z0 + l.z1) / 2 + 0.006 }));
    }
  }
  for (const r of layout.rails) {
    if (r.invisible) continue;
    wb.add(M.rail, boxGeo({ ...r, y0: r.y1 - 0.05 }));
    gl.add(M.glass, boxGeo({ ...r, y0: 0.08, y1: r.y1 - 0.05, z0: r.z0 + 0.02, z1: r.z1 - 0.02 }));
  }
  wb.flush(group);
  for (const g of layout.glass) gl.add(M.glass, boxGeo(g));
  gl.flush(group, { cast: false, receive: false });

  // door handles
  const hb = new Batch();
  for (const l of layout.leaves) {
    if (l.glass) continue;
    const hx = (l.x0 + l.x1) / 2, hz = (l.z0 + l.z1) / 2;
    const wide = l.x1 - l.x0 > l.z1 - l.z0;
    const g = wide
      ? new THREE.BoxGeometry(0.12, 0.03, 0.09).translate(l.hingeSide === 'hi' ? l.x0 + 0.1 : l.x1 - 0.1, 1.0, hz)
      : new THREE.BoxGeometry(0.09, 0.03, 0.12).translate(hx, 1.0, l.hingeSide === 'hi' ? l.z0 + 0.1 : l.z1 - 0.1);
    hb.add(M.steel, g);
  }
  hb.flush(group, { cast: false, receive: false });

  // ---- floors (voids and stair openings are left out)
  const holes = plan.floorHoles || [];
  const fb = new Batch();
  for (const room of plan.rooms) {
    if (room.void || room.noFloor) continue;
    for (const q of room.rects) {
      for (const r of subtractRects(q, holes)) {
        const g = new THREE.PlaneGeometry(r[2] - r[0], r[3] - r[1]);
        g.rotateX(-Math.PI / 2);
        g.translate((r[0] + r[2]) / 2, 0.001, (r[1] + r[3]) / 2);
        const pos = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
        fb.add(M.floor[room.floor], g);
      }
    }
  }
  fb.flush(group, { cast: false, receive: true });

  // ---- skirting boards, bathroom wall tiles (to 1.2 m), window sills and curtains
  const furnRects0 = [];
  for (const it of plan.furniture) {
    const sz = sizeOf(it);
    if (sz[3]) furnRects0.push(rectOfFurniture(it, sz));
  }
  const detail = new Batch();
  const tilesB = new Batch();
  const drapes = new Batch();
  const INSIDE = { 'n-outer': [0, 1], 's-outer': [0, -1], 's-outer-bath': [0, -1], 'w-outer': [1, 0], 'e-outer': [-1, 0] };
  for (const sd of layout.solids) {
    if (!sd.collide || sd.diag || sd.y0 !== 0) continue;
    const dx = sd.x1 - sd.x0, dz = sd.z1 - sd.z0;
    const alongX = dx > dz;
    const t = alongX ? dz : dx;
    const sides = INSIDE[sd.wall] ? [INSIDE[sd.wall]] : alongX ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    for (const n of sides) {
      const room = roomAt(plan, (sd.x0 + sd.x1) / 2 + n[0] * (t / 2 + 0.3), (sd.z0 + sd.z1) / 2 + n[1] * (t / 2 + 0.3));
      if (!room || room.void || room.open) continue;
      const bath = room.floor === 'bath';
      const d = bath ? 0.012 : 0.014;
      const hgt = bath ? Math.min(1.2, sd.y1) : 0.1;
      let x0 = sd.x0, x1 = sd.x1, z0 = sd.z0, z1 = sd.z1;
      if (alongX) { if (n[1] > 0) { z0 = sd.z1; z1 = sd.z1 + d; } else { z1 = sd.z0; z0 = sd.z0 - d; } }
      else if (n[0] > 0) { x0 = sd.x1; x1 = sd.x1 + d; } else { x1 = sd.x0; x0 = sd.x0 - d; }
      const bx = { x0, x1, z0, z1, y0: 0, y1: hgt };
      if (bath) tilesB.add(M.wallTile, worldUV(boxGeo(bx)));
      else detail.add(M.skirt, boxGeo(bx));
    }
  }
  const hitsFurniture = (r) => furnRects0.some((f) => r.x0 < f.x1 + 0.1 && r.x1 > f.x0 - 0.1 && r.z0 < f.z1 + 0.1 && r.z1 > f.z0 - 0.1);
  for (const op of layout.openings) {
    if (op.kind !== 'window') continue;
    const mid = (op.s0 + op.s1) / 2;
    for (const n of op.horiz ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) {
      const room = roomAt(plan, op.horiz ? mid : op.c + n[0] * (op.t / 2 + 0.5), op.horiz ? op.c + n[1] * (op.t / 2 + 0.5) : mid);
      if (!room || room.void || room.open) continue;
      const sb = (s0, s1, y0, y1, o0, o1) => {
        const a0 = op.t / 2 + o0, a1 = op.t / 2 + o1;
        const lo = Math.min(op.c + (op.horiz ? n[1] : n[0]) * a0, op.c + (op.horiz ? n[1] : n[0]) * a1);
        const hi = Math.max(op.c + (op.horiz ? n[1] : n[0]) * a0, op.c + (op.horiz ? n[1] : n[0]) * a1);
        return op.horiz ? { x0: s0, x1: s1, z0: lo, z1: hi, y0, y1 } : { x0: lo, x1: hi, z0: s0, z1: s1, y0, y1 };
      };
      detail.add(M.sillBoard, boxGeo(sb(op.s0 - 0.05, op.s1 + 0.05, op.sill - 0.03, op.sill, 0, 0.1))); // sill ledge
      if ((room.name === 'Bedroom' || room.name === 'Drawing Room') && op.sill <= 1.0 && op.s1 - op.s0 >= 0.9 && op.h >= 1.2) {
        const mat = room.name === 'Bedroom' ? M.curtain : M.curtainB;
        for (const [a0, a1] of [[op.s0 - 0.5, op.s0 - 0.05], [op.s1 + 0.05, op.s1 + 0.5]]) {
          const panel = sb(a0, a1, 0.1, 2.5, 0.01, 0.08);
          const low = hitsFurniture({ ...panel, ...(op.horiz ? { z0: panel.z0 - 0.3, z1: panel.z1 + 0.3 } : { x0: panel.x0 - 0.3, x1: panel.x1 + 0.3 }) });
          const NS = 6;
          for (let q = 0; q < NS; q++) {
            const e = q % 2 ? 0.028 : 0;
            const strip = { ...panel, y0: low ? 0.95 : 0.1 };
            if (op.horiz) {
              const w0 = panel.x0 + ((panel.x1 - panel.x0) * q) / NS, w1 = panel.x0 + ((panel.x1 - panel.x0) * (q + 1)) / NS;
              strip.x0 = w0; strip.x1 = w1;
              if (n[1] > 0) strip.z1 += e; else strip.z0 -= e;
            } else {
              const w0 = panel.z0 + ((panel.z1 - panel.z0) * q) / NS, w1 = panel.z0 + ((panel.z1 - panel.z0) * (q + 1)) / NS;
              strip.z0 = w0; strip.z1 = w1;
              if (n[0] > 0) strip.x1 += e; else strip.x0 -= e;
            }
            drapes.add(mat, boxGeo(strip));
          }
        }
        detail.add(M.steel, boxGeo(sb(op.s0 - 0.55, op.s1 + 0.55, 2.5, 2.54, 0.03, 0.07))); // rod
      }
    }
  }
  detail.flush(group, { cast: false, receive: true });
  tilesB.flush(group, { cast: false, receive: true });
  drapes.flush(group, { cast: true, receive: true });

  let shape = null;
  if (isFirst) {
    // structural slab under the first floor: openings for the courtyard, shafts and the stairwell
    const slabShape = new THREE.Shape();
    const sr = plan.slabRect || [fp.x0, fp.z0, fp.x1, fp.z1];
    slabShape.moveTo(sr[0], sr[1]); slabShape.lineTo(sr[2], sr[1]); slabShape.lineTo(sr[2], sr[3]); slabShape.lineTo(sr[0], sr[3]); slabShape.closePath();
    for (const r of plan.rooms) {
      if (!r.void) continue;
      for (const q of r.rects) {
        const p = new THREE.Path();
        p.moveTo(q[0], q[1]); p.lineTo(q[0], q[3]); p.lineTo(q[2], q[3]); p.lineTo(q[2], q[1]); p.closePath();
        slabShape.holes.push(p);
      }
    }
    for (const poly of plan.slabHoles || []) {
      const p = new THREE.Path();
      poly.forEach(([x, z], i) => (i ? p.lineTo(x, z) : p.moveTo(x, z)));
      p.closePath();
      slabShape.holes.push(p);
    }
    const sg = new THREE.ExtrudeGeometry(slabShape, { depth: 0.3, bevelEnabled: false });
    sg.rotateX(Math.PI / 2);
    const slab = new THREE.Mesh(sg, M.slab);
    slab.castShadow = true; slab.receiveShadow = true;
    group.add(slab);

    // ceiling plane with holes for open-to-sky rooms
    const e = plan.wallThickness.outer / 2;
    const bw = plan.walls.find((w) => w.id === 'e-outer');
    const bx1 = bw.a[0] + e;
    const bz1 = plan.ceilingOutline ? Math.max(...plan.ceilingOutline.map((p) => p[1])) : Math.max(bw.a[1], bw.b[1]) + e;
    shape = new THREE.Shape();
    if (plan.ceilingOutline) {
      plan.ceilingOutline.forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)));
      shape.closePath();
    } else {
      shape.moveTo(-e, -e); shape.lineTo(bx1, -e); shape.lineTo(bx1, bz1); shape.lineTo(-e, bz1); shape.closePath();
    }
    for (const r of plan.rooms) {
      if (!r.open && !r.void) continue;
      if (r.rects.some((q) => q[1] < -0.1 || q[3] > bz1 + 0.01)) continue;
      for (const q of r.rects) {
        const p = new THREE.Path();
        p.moveTo(q[0], q[1]); p.lineTo(q[0], q[3]); p.lineTo(q[2], q[3]); p.lineTo(q[2], q[1]); p.closePath();
        shape.holes.push(p);
      }
    }
    for (const q of plan.ceilingHoles || []) {
      const p = new THREE.Path();
      p.moveTo(q[0], q[1]); p.lineTo(q[0], q[3]); p.lineTo(q[2], q[3]); p.lineTo(q[2], q[1]); p.closePath();
      shape.holes.push(p);
    }
    const cg = new THREE.ShapeGeometry(shape);
    cg.rotateX(Math.PI / 2);
    cg.translate(0, H + 0.02, 0);
    const ceiling = new THREE.Mesh(cg, M.ceiling);
    ceiling.castShadow = true; ceiling.receiveShadow = true;
    ceilGroup.add(ceiling);
  }

  // false ceiling: a dropped border with a warm LED cove (bedrooms and drawing rooms)
  const fc = new Batch(), cv = new Batch();
  for (const room of plan.rooms) {
    if (room.name !== 'Bedroom' && room.name !== 'Drawing Room') continue;
    const q = room.rects[0];
    const W0 = plan.footprint;
    const ins = (v, edge) => (Math.abs(v - edge) < 0.2 ? 0.125 : 0.06);
    const x0 = q[0] + ins(q[0], 0), x1 = q[2] - ins(q[2], 10.47);
    const z0 = q[1] + ins(q[1], 0), z1 = q[3] - (q[3] > 17.4 ? 0.125 : 0.06);
    void W0;
    const bw = 0.42, dp = 0.12, y0 = H - dp;
    fc.add(M.ceiling, boxGeo({ x0, x1, z0, z1: z0 + bw, y0, y1: H }));
    fc.add(M.ceiling, boxGeo({ x0, x1, z0: z1 - bw, z1, y0, y1: H }));
    fc.add(M.ceiling, boxGeo({ x0, x1: x0 + bw, z0: z0 + bw, z1: z1 - bw, y0, y1: H }));
    fc.add(M.ceiling, boxGeo({ x0: x1 - bw, x1, z0: z0 + bw, z1: z1 - bw, y0, y1: H }));
    const t = 0.025, sy = y0 - 0.012;
    cv.add(M.cove, boxGeo({ x0: x0 + bw, x1: x1 - bw, z0: z0 + bw, z1: z0 + bw + t, y0: sy, y1: y0 }));
    cv.add(M.cove, boxGeo({ x0: x0 + bw, x1: x1 - bw, z0: z1 - bw - t, z1: z1 - bw, y0: sy, y1: y0 }));
    cv.add(M.cove, boxGeo({ x0: x0 + bw, x1: x0 + bw + t, z0: z0 + bw, z1: z1 - bw, y0: sy, y1: y0 }));
    cv.add(M.cove, boxGeo({ x0: x1 - bw - t, x1: x1 - bw, z0: z0 + bw, z1: z1 - bw, y0: sy, y1: y0 }));
  }
  fc.flush(ceilGroup, { cast: false, receive: true });
  cv.flush(ceilGroup, { cast: false, receive: false });

  // ceiling light discs
  const lb = new Batch();
  for (const l of plan.lights) if (l.kind === 'lamp') lb.add(M.lampDisc, new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16).translate(l.x, H - 0.01, l.y));
  lb.flush(ceilGroup, { cast: false, receive: false });

  // ---- stairs (each step a solid block; upper-flight steps are slabs that hang over the stairwell)
  const sb = new Batch();
  const st = plan.stairs;
  if (st) {
    const rise = st.rise;
    for (const f of st.flights) {
      const n = f.steps;
      const td = Math.abs(f.to - f.from) / n;
      const dir = f.to > f.from ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const top = (f.start + i + 1) * rise;
        const y0 = f.float ? Math.max(0, top - 0.3) : 0;
        const a0 = f.from + dir * i * td, a1 = a0 + dir * td;
        const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
        let r;
        if (f.axis === 'z') {
          r = { x0: f.x0, x1: f.x1, z0: lo, z1: hi, y0, y1: top };
          if (f.rail) {
            const rx = f.rail === 'x0' ? f.x0 : f.x1 - 0.04;
            sb.add(M.rail, boxGeo({ x0: rx, x1: rx + 0.04, z0: lo, z1: lo + 0.04, y0: top, y1: top + 0.9 }));
            sb.add(M.rail, boxGeo({ x0: rx, x1: rx + 0.04, z0: lo, z1: hi, y0: top + 0.86, y1: top + 0.9 }));
          }
        } else {
          r = { x0: lo, x1: hi, z0: f.z0, z1: f.z1, y0, y1: top };
          if (f.rail) {
            const rz = f.rail === 'z0' ? f.z0 : f.z1 - 0.04;
            sb.add(M.rail, boxGeo({ x0: lo, x1: lo + 0.04, z0: rz, z1: rz + 0.04, y0: top, y1: top + 0.9 }));
            sb.add(M.rail, boxGeo({ x0: lo, x1: hi, z0: rz, z1: rz + 0.04, y0: top + 0.86, y1: top + 0.9 }));
          }
        }
        sb.add(M.stair, boxGeo(r));
        sb.add(M.stairEdge, boxGeo(f.axis === 'z'
          ? { ...r, z0: dir < 0 ? hi - 0.025 : lo, z1: dir < 0 ? hi : lo + 0.025, y0: top - 0.025 }
          : { ...r, x0: dir < 0 ? hi - 0.025 : lo, x1: dir < 0 ? hi : lo + 0.025, y0: top - 0.025 }));
      }
    }
    for (const l of st.landings || []) {
      const top = l.index * rise;
      sb.add(M.stair, boxGeo({ x0: l.rect[0], z0: l.rect[1], x1: l.rect[2], z1: l.rect[3], y0: l.float ? top - 0.3 : 0, y1: top }));
    }
  }
  sb.flush(group);

  // ---- furniture
  const furnBatch = new Batch();
  buildFurniture(plan.furniture, M, furnBatch);
  furnBatch.flush(group);
  const furnRects = [];
  for (const it of plan.furniture) {
    const s = sizeOf(it);
    if (!s[3]) continue;
    furnRects.push({ ...rectOfFurniture(it, s), y0: 0, y1: s[2], item: it.type });
  }
  // soft contact shadow under every piece of furniture
  const ao = new Batch();
  for (const r of furnRects) {
    const g = new THREE.PlaneGeometry(r.x1 - r.x0 + 0.4, r.z1 - r.z0 + 0.4);
    g.rotateX(-Math.PI / 2);
    g.translate((r.x0 + r.x1) / 2, 0.004, (r.z0 + r.z1) / 2);
    ao.add(M.aoBlob, g);
  }
  ao.flush(group, { cast: false, receive: false });
  const rects = collisionRects(layout, furnRects);
  for (const r of rects) { if (r.f0 === undefined) r.f0 = f0; if (r.f1 === undefined) r.f1 = f1; }

  const sources = plan.lights.map((l) => ({
    kind: l.kind,
    pos: new THREE.Vector3(l.x, yOff + (l.kind === 'lamp' ? H - 0.3 : 1.7), l.y),
    color: new THREE.Color(l.kind === 'lamp' ? 0xffd9a0 : 0xdfeaff),
    intensity: l.kind === 'lamp' ? 9 : 5,
    distance: l.kind === 'lamp' ? 7 : 8,
  }));

  return { plan, layout, group, ceilGroup, rects, sources, shape, floorY: yOff };
}

export function buildScene(first, ground, M, { mobile }) {
  const scene = new THREE.Scene();
  const L1 = buildFloor(first, M, { yOff: 0, f0: -0.3, f1: 99, isFirst: true });
  const L0 = buildFloor(ground, M, { yOff: -FLOOR_H, f0: -99, f1: -0.3, isFirst: false });
  scene.add(L1.group, L1.ceilGroup, L0.group, L0.ceilGroup);

  // exterior: facade, roof, tower, boundary wall, neighbours, ground plane
  const ext = new THREE.Group();
  scene.add(ext);
  const ex = buildExterior({ layout: L1.layout, groundLayout: L0.layout, M, firstGroup: L1.group, roofGroup: L1.ceilGroup, extGroup: ext, shape: L1.shape });
  const exteriorRects = ex.rects;
  for (const r of exteriorRects) { if (r.f0 === undefined) r.f0 = -99; if (r.f1 === undefined) r.f1 = -0.3; }

  const rects = [...L1.rects, ...L0.rects, ...exteriorRects];

  // ---- lights
  const fp = first.footprint;
  const hemi = new THREE.HemisphereLight(0xbfcdf0, 0x8a7a68, 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0e0, 1.05);
  const cx = (fp.x0 + fp.x1) / 2, cz = (fp.z0 + fp.z1) / 2;
  sun.target.position.set(cx, 0, cz);
  sun.castShadow = true;
  const ms = mobile ? 2048 : 4096;
  sun.shadow.mapSize.set(ms, ms);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  // front fill light, switched on only in the outside view so the street facade is lit
  const fill = new THREE.DirectionalLight(0xfff0dc, 0);
  fill.position.set(cx - 8, 16, cz + 34);
  fill.target.position.set(cx, 0, cz);
  scene.add(fill, fill.target);

  // Exterior lights that only exist at night: gate wall lights, soffit downlights under the overhangs, balcony
  const NIGHT = [
    [5.8, -0.55, 17.9], [9.08, -0.55, 17.9], [3.0, 0.1, 17.9], [6.3, -0.55, 18.1], [8.0, -0.55, 18.1], [9.6, -0.55, 18.1],
    [1.4, -0.55, 18.2], [3.4, -0.55, 18.2], [7.0, 2.6, 18.0], [9.4, 2.6, 18.0], [3.5, 2.6, 18.0], [12.5, 1.5, 21.4], [-1.2, 1.5, 21.4],
  ].map(([x, y, z]) => ({ kind: 'night', pos: new THREE.Vector3(x, y, z), color: new THREE.Color(0xffd9a0), intensity: 8, distance: 6 }));
  const sources = [...L1.sources, ...L0.sources, ...NIGHT];
  const pool = [];
  const POOL = mobile ? 5 : 8;
  for (let i = 0; i < POOL; i++) {
    const p = new THREE.PointLight(0xffffff, 0, 8, 2);
    scene.add(p);
    pool.push(p);
  }
  const tmp = new THREE.Vector3();
  const warm = new THREE.Color(0xffd9a0), cool = new THREE.Color(0xdfeaff);
  let night = false;
  function updateLights(x, y, z, all) {
    tmp.set(x, y + 1.5, z);
    const list = sources;
    const sorted = list.map((q) => [q, q.pos.distanceToSquared(tmp)]).sort((p, q) => p[1] - q[1]);
    for (let i = 0; i < pool.length; i++) {
      const q = sorted[i] ? sorted[i][0] : null;
      const p = pool[i];
      if (!q) { p.intensity = 0; continue; }
      p.position.copy(q.pos);
      // at night the daylight fill lights in the windowed rooms turn into warm room lights
      p.color.copy(q.kind === 'day' ? (night ? warm : cool) : q.color);
      p.distance = q.distance;
      const k = q.kind === 'night' ? (night ? 1.25 : 0.75) : q.kind === 'day' ? (night ? 1.3 : 1) : night ? 1.25 : 1;
      p.intensity = q.intensity * k * (all ? 0.6 : 1);
    }
  }

  // realistic atmospheric sky, low warm dusk sun from the south-west (like the elevation photo); night lowers the sun
  const SKY = {
    day: { turbidity: 5, rayleigh: 1.5, mie: 0.006, g: 0.82, el: 9, az: -38 },
    night: { turbidity: 2, rayleigh: 0.15, mie: 0.001, g: 0.7, el: -14, az: -38 },
  };
  const sunVec = new THREE.Vector3();
  function applySky(sk, st) {
    const u = sk.material.uniforms;
    u.turbidity.value = st.turbidity; u.rayleigh.value = st.rayleigh; u.mieCoefficient.value = st.mie; u.mieDirectionalG.value = st.g;
    u.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - st.el), THREE.MathUtils.degToRad(st.az));
  }
  const sky = new Sky();
  sky.scale.setScalar(4000);
  sky.frustumCulled = false;
  scene.add(sky);
  applySky(sky, SKY.day);
  const aimSun = (st) => {
    sunVec.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(st.el, 25)), THREE.MathUtils.degToRad(st.az));
    sun.position.copy(sun.target.position).addScaledVector(sunVec, 80);
  };
  aimSun(SKY.day);
  const night0 = () => night;

  function setNight(on) {
    night = on;
    applySky(sky, on ? SKY.night : SKY.day);
    aimSun(on ? SKY.day : SKY.day);
    sun.color.set(on ? 0x8fa6ff : 0xfff0e0); // moonlight
    sun.intensity = on ? 0.5 : 1.05;
    hemi.color.set(on ? 0x2a3358 : 0xbfcdf0);
    M.sand.color.set(on ? 0x8d7f6a : 0xb89f84);
    M.paving.color.set(on ? 0x6f6f70 : 0xa39a98);
    renderer_exposure.value = on ? 1.25 : 1.0;
  }
  void night0;
  const renderer_exposure = { value: 1.0 };

  return { scene, sky, levels: { first: L1, ground: L0 }, gates: ex.gates, ext, rects, sun, fill, hemi, updateLights, setNight, exposure: renderer_exposure, isNight: () => night };
}


// reflection environments rendered from the same sky (day and night)
export function skyEnvironments(renderer) {
  const make = (st) => {
    const sc = new THREE.Scene();
    const sk = new Sky();
    sk.scale.setScalar(1000);
    const u = sk.material.uniforms;
    u.turbidity.value = st.turbidity; u.rayleigh.value = st.rayleigh; u.mieCoefficient.value = st.mie; u.mieDirectionalG.value = st.g;
    u.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - st.el), THREE.MathUtils.degToRad(st.az));
    sc.add(sk);
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(sc, 0.02).texture;
    pm.dispose();
    return tex;
  };
  return {
    day: make({ turbidity: 5, rayleigh: 1.5, mie: 0.006, g: 0.82, el: 9, az: -38 }),
    night: make({ turbidity: 2, rayleigh: 0.15, mie: 0.001, g: 0.7, el: -14, az: -38 }),
  };
}
