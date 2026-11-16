// Pure geometry derived from floorplan.json (no three.js). Used by the scene and by tools/validate.mjs.
// Rects are { x0, x1, z0, z1, y0, y1 } in metres; plan "y" becomes world "z".

export function computeLayout(plan) {
  const H = plan.ceilingHeight;
  const DH = plan.doorHeight;
  const solids = []; // wall pieces: { ...rect, collide }
  const frames = [];
  const glass = [];
  const leaves = [];
  const blockers = []; // collision only (floor-to-ceiling glass)
  const openings = []; // for validation / minimap: { wall, kind, s0, s1, horiz, c, t, sill, h }

  for (const w of plan.walls) {
    const horiz = w.a[1] === w.b[1];
    const c = horiz ? w.a[1] : w.a[0];
    const t = w.t;
    const lo = (horiz ? Math.min(w.a[0], w.b[0]) : Math.min(w.a[1], w.b[1])) - t / 2;
    const hi = (horiz ? Math.max(w.a[0], w.b[0]) : Math.max(w.a[1], w.b[1])) + t / 2;
    const R = (s0, s1, y0, y1, th = t) =>
      horiz
        ? { x0: s0, x1: s1, z0: c - th / 2, z1: c + th / 2, y0, y1 }
        : { x0: c - th / 2, x1: c + th / 2, z0: s0, z1: s1, y0, y1 };
    const ops = [...w.openings].sort((p, q) => p.at - q.at);
    let cur = lo;
    for (const o of ops) {
      const o0 = o.at - o.w / 2;
      const o1 = o.at + o.w / 2;
      const isWin = o.kind === 'window';
      const sill = isWin ? o.sill ?? 0.9 : 0;
      const h = isWin ? o.h ?? 1.2 : o.h ?? DH;
      if (o0 > cur) solids.push({ ...R(cur, o0, 0, H), collide: true, wall: w.id });
      if (sill > 0) solids.push({ ...R(o0, o1, 0, sill), collide: true, wall: w.id, sillPiece: true });
      if (sill + h < H) solids.push({ ...R(o0, o1, sill + h, H), collide: false, wall: w.id });
      if (isWin && sill < 0.3) blockers.push({ ...R(o0, o1, 0, sill + h), collide: true, wall: w.id, glassBlock: true });
      openings.push({ wall: w.id, kind: o.kind, open: !!o.open, s0: o0, s1: o1, horiz, c, t, sill, h, rect: R(o0, o1, sill, sill + h) });

      if (o.kind === 'sliding') {
        // aluminium-framed sliding glass door: a fixed pane and a sliding pane; when open the sliding pane stacks over the fixed one
        const Ro = (a0, a1, y0, y1, th, off) => (horiz
          ? { x0: a0, x1: a1, z0: c + off - th / 2, z1: c + off + th / 2, y0, y1 }
          : { x0: c + off - th / 2, x1: c + off + th / 2, z0: a0, z1: a1, y0, y1 });
        const pw = o.w * 0.55;
        const panes = [[o0, o0 + pw, -0.03], o.open ? [o0, o0 + pw, 0.03] : [o1 - pw, o1, 0.03]];
        frames.push({ ...R(o0 - 0.03, o0 + 0.04, 0, h, t + 0.02), mat: 'alu' });
        frames.push({ ...R(o1 - 0.04, o1 + 0.03, 0, h, t + 0.02), mat: 'alu' });
        frames.push({ ...R(o0, o1, h - 0.05, h, t + 0.02), mat: 'alu' });
        frames.push({ ...R(o0, o1, 0, 0.03, t + 0.02), mat: 'alu' });
        const b = 0.04;
        for (const [pa, pb, off] of panes) {
          frames.push({ ...Ro(pa, pa + b, 0.03, h - 0.05, 0.045, off), mat: 'alu' });
          frames.push({ ...Ro(pb - b, pb, 0.03, h - 0.05, 0.045, off), mat: 'alu' });
          frames.push({ ...Ro(pa, pb, 0.03, 0.03 + b, 0.045, off), mat: 'alu' });
          frames.push({ ...Ro(pa, pb, h - 0.05 - b, h - 0.05, 0.045, off), mat: 'alu' });
          glass.push(Ro(pa + b, pb - b, 0.03 + b, h - 0.05 - b, 0.012, off));
        }
        const hx = o.open ? o0 + pw - 0.08 : o1 - pw + 0.04;
        frames.push({ ...Ro(hx, hx + 0.03, 0.9, 1.3, 0.05, 0.03), mat: 'alu' }); // handle
        blockers.push({ ...R(o0, o.open ? o0 + pw : o1, 0, h), collide: true, wall: w.id, glassBlock: true });
      } else if (isWin) {
        const fd = 0.08;
        const bar = 0.05;
        frames.push({ ...R(o0, o0 + bar, sill, sill + h, fd), mat: 'alu' });
        frames.push({ ...R(o1 - bar, o1, sill, sill + h, fd), mat: 'alu' });
        frames.push({ ...R(o0, o1, sill, sill + bar, fd), mat: 'alu' });
        frames.push({ ...R(o0, o1, sill + h - bar, sill + h, fd), mat: 'alu' });
        const nm = o.w > 1.3 ? Math.floor(o.w / 1.0) - 1 : 0;
        for (let i = 1; i <= nm; i++) {
          const m = o0 + (o.w * i) / (nm + 1);
          frames.push({ ...R(m - 0.02, m + 0.02, sill, sill + h, fd), mat: 'alu' });
        }
        glass.push(R(o0 + bar, o1 - bar, sill + bar, sill + h - bar, 0.012));
        // ledge on the inside face is skipped; sill piece is solid wall.
      } else if (o.kind !== 'open' && o.kind !== 'sliding') {
        const fm = o.kind === 'slider' ? 'alu' : 'wood';
        const j = 0.05;
        const th = t + 0.03;
        frames.push({ ...R(o0 - j, o0, 0, DH + j, th), mat: fm });
        frames.push({ ...R(o1, o1 + j, 0, DH + j, th), mat: fm });
        frames.push({ ...R(o0 - j, o1 + j, DH, DH + j, th), mat: fm });
        if (o.kind === 'door') {
          const lt = 0.04;
          const cfgs = o.double
            ? [{ hinge: 'lo', a: o0, b: o.at }, { hinge: 'hi', a: o.at, b: o1 }]
            : [{ hinge: o.hinge, a: o0, b: o1 }];
          for (const k of cfgs) {
            const len = k.b - k.a - 0.015;
            const s = k.hinge === 'hi' ? [k.b - lt, k.b] : [k.a, k.a + lt];
            const n0 = o.swing > 0 ? c + t / 2 : c - t / 2 - len;
            const n1 = o.swing > 0 ? c + t / 2 + len : c - t / 2;
            const r = horiz
              ? { x0: s[0], x1: s[1], z0: n0, z1: n1, y0: 0.02, y1: DH - 0.05 }
              : { x0: n0, x1: n1, z0: s[0], z1: s[1], y0: 0.02, y1: DH - 0.05 };
            leaves.push({ ...r, wall: w.id, hingeSide: k.hinge, glass: !!o.glass });
          }
        }
      }
      cur = o1;
    }
    if (hi > cur) solids.push({ ...R(cur, hi, 0, H), collide: true, wall: w.id });
  }

  const blocks = (plan.blocks || []).map((b) => ({ x0: b.rect[0], z0: b.rect[1], x1: b.rect[2], z1: b.rect[3], y0: 0, y1: H, collide: true }));
  const slabs = (plan.slabs || []).map((s) => ({ x0: s.rect[0], z0: s.rect[1], x1: s.rect[2], z1: s.rect[3], y0: 0, y1: s.h, collide: true }));
  const columns = (plan.columns || []).map((c) => ({ x0: c.x - c.s / 2, x1: c.x + c.s / 2, z0: c.y - c.s / 2, z1: c.y + c.s / 2, y0: 0, y1: H, collide: true }));
  const rails = (plan.rails || []).map((r) => {
    const horiz = r.a[1] === r.b[1];
    const th = 0.06;
    return horiz
      ? { x0: Math.min(r.a[0], r.b[0]), x1: Math.max(r.a[0], r.b[0]), z0: r.a[1] - th / 2, z1: r.a[1] + th / 2, y0: 0, y1: r.h, collide: true, invisible: r.invisible, f0: r.f0, f1: r.f1 }
      : { x0: r.a[0] - th / 2, x1: r.a[0] + th / 2, z0: Math.min(r.a[1], r.b[1]), z1: Math.max(r.a[1], r.b[1]), y0: 0, y1: r.h, collide: true, invisible: r.invisible, f0: r.f0, f1: r.f1 };
  });
  const stairRects = ((plan.stairs && plan.stairs.collide) || []).map((e) => {
    const r = Array.isArray(e) ? e : e.rect;
    return { x0: r[0], z0: r[1], x1: r[2], z1: r[3], y0: 0, y1: 2.9, collide: true, f0: e.f0, f1: e.f1 };
  });

  // angled walls: visual segments + a chain of small collision squares
  const diagSegs = [];
  for (const d of plan.diagonals || []) {
    const dx = d.b[0] - d.a[0], dz = d.b[1] - d.a[1];
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    const gaps = [...(d.gaps || [])].sort((p, q) => p[0] - q[0]);
    const pieces = [];
    let cur = 0;
    for (const g of gaps) { if (g[0] > cur) pieces.push([cur, g[0]]); cur = g[1]; }
    if (cur < len) pieces.push([cur, len]);
    for (const [s0, s1] of pieces) {
      const mx = d.a[0] + ux * (s0 + s1) / 2, mz = d.a[1] + uz * (s0 + s1) / 2;
      diagSegs.push({ cx: mx, cz: mz, len: s1 - s0, t: d.t, angle: Math.atan2(-dz, dx) });
      for (let s = s0; s <= s1; s += 0.07) {
        const x = d.a[0] + ux * s, z = d.a[1] + uz * s, h = d.t / 2;
        solids.push({ x0: x - h, x1: x + h, z0: z - h, z1: z + h, y0: 0, y1: H, collide: true, wall: d.id, diag: true });
      }
    }
  }

  return { slabs, blockers, diagSegs, solids, frames, glass, leaves, blocks, columns, rails, stairRects, openings };
}

export function rectOfFurniture(item, size) {
  const swap = item.face === 'E' || item.face === 'W';
  const w = swap ? size[1] : size[0];
  const d = swap ? size[0] : size[1];
  return { x0: item.x - w / 2, x1: item.x + w / 2, z0: item.y - d / 2, z1: item.y + d / 2 };
}

export function collisionRects(layout, furnitureRects) {
  const out = [];
  for (const s of layout.solids) if (s.collide) out.push(s);
  for (const l of layout.leaves) out.push(l);
  for (const b of layout.blockers) out.push(b);
  for (const b of layout.blocks) out.push(b);
  for (const b of layout.slabs) out.push(b);
  for (const c of layout.columns) out.push(c);
  for (const r of layout.rails) out.push(r);
  for (const r of layout.stairRects) out.push(r);
  for (const f of furnitureRects) out.push(f);
  return out;
}

export function roomAt(plan, x, z) {
  for (const r of plan.rooms) for (const q of r.rects) if (x >= q[0] && x < q[2] && z >= q[1] && z < q[3]) return r;
  return null;
}
