// Exterior of the house, modelled from the front elevation (04C, Taupe and Bronze).
// The elevation is the street (south) front. Plan x runs left to right, plan y (world z) runs towards the street.
// Heights are metres above the first-floor finished floor (y = 0); ground level is GY. Storeys are 3.0 m clear, slabs 0.3 m.
import * as THREE from 'three';
import { Batch, worldUV } from './batch.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

function seeded(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// a cloud of leaf cards inside an ellipsoid (trees, hedges)
function cards(batch, M, cx, cy, cz, rx, ry, rz, n, size, seed) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, k = Math.sqrt(1 - u * u);
    const g = new THREE.PlaneGeometry(size * (0.55 + 0.25 * r()), size * (0.85 + 0.4 * r()));
    g.translate(0, g.parameters.height / 2, 0);
    g.rotateX(-0.9 + r() * 1.2);
    g.rotateY(r() * Math.PI * 2);
    g.translate(cx + rx * k * Math.cos(a) * (0.35 + 0.65 * r()), cy + ry * u * (0.35 + 0.65 * r()), cz + rz * k * Math.sin(a) * (0.35 + 0.65 * r()));
    batch.add(r() > 0.45 ? M.leafCard : M.leafCard2, g);
  }
}

// soft additive halo used for the lights (the elevation shows them glowing)
function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,236,190,1)'); r.addColorStop(0.25, 'rgba(255,200,120,0.55)'); r.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const GY = -3.3;
const RFRONT = 17.615; // outer face of the first-floor wall on the right (flush with the ground floor)
const LFRONT = 18.525; // outer face of the left block (bath and balcony): the plan's 3'-0" overhang
const GFRONT = 17.615; // outer face of the ground-floor wall
const XL = -0.115, XR = 10.585;
const GZ = 18.45; // gate and planter-wall plane (plot line)
const H = 3.0;

const rect = (x0, z0, x1, z1, f0, f1) => ({ x0, z0, x1, z1, y0: 0, y1: 2, collide: true, f0, f1 });

// framed slat panel (gates): horizontal or vertical slats inside a bronze frame
function slatPanel(M, b, x0, x1, y0, y1, z0, z1, vertical) {
  const f = 0.07;
  b.box(M.bronze, x0, y0, z0, x1, y0 + f, z1);
  b.box(M.bronze, x0, y1 - f, z0, x1, y1, z1);
  b.box(M.bronze, x0, y0, z0, x0 + f, y1, z1);
  b.box(M.bronze, x1 - f, y0, z0, x1, y1, z1);
  const zz = z1 - 0.01;
  if (vertical) {
    for (let x = x0 + 0.12; x < x1 - 0.1; x += 0.11) b.box(M.slat, x, y0 + f, z0, x + 0.045, y1 - f, zz + 0.03);
  } else {
    for (let y = y0 + f + 0.02; y < y1 - f - 0.1; y += 0.22) b.box(M.slat, x0 + f, y, z0, x1 - f, y + 0.18, zz + 0.03);
  }
}

export function buildExterior({ layout, groundLayout, M, firstGroup, roofGroup, extGroup, shape }) {
  const B = new Batch(); // first-floor exterior pieces
  const E = new Batch(); // ground-level pieces that are always visible
  const R = new Batch(); // roof and tower
  const SKIN = 0.02;
  const outer = { 'n-outer': 'n', 's-outer': 's', 's-outer-bath': 's', 'w-outer': 'w', 'e-outer': 'e' };
  const g0 = GY, g1 = -0.3;
  let hedgeSeed = 5;
  const hedge = (x0, y0, z0, x1, y1, z1) => {
    E.box(M.hedgeDark, x0, y0, z0, x1, y1 - 0.08, z1);
    const n = Math.round(((x1 - x0) * (z1 - z0) + (x1 - x0) * (y1 - y0)) * 70);
    cards(E, M, (x0 + x1) / 2, y0 + (y1 - y0) * 0.45, (z0 + z1) / 2, (x1 - x0) / 2, (y1 - y0) * 0.7, Math.max(0.1, (z1 - z0) / 2), Math.min(n, 260), 0.2, hedgeSeed++);
  };

  // ---- exterior paint on the outer faces of both storeys' walls
  const skin = (batch, solids, dy) => {
    for (const s of solids) {
      const side = outer[s.wall];
      if (!side) continue;
      const y0 = s.y0 + dy, y1 = s.y1 + dy;
      if (side === 'n') batch.box(M.cream, s.x0, y0, s.z0 - SKIN, s.x1, y1, s.z0);
      if (side === 's') batch.box(M.cream, s.x0, y0, s.z1, s.x1, y1, s.z1 + SKIN);
      if (side === 'w') batch.box(M.cream, s.x0 - SKIN, y0, s.z0, s.x0, y1, s.z1);
      if (side === 'e') batch.box(M.cream, s.x1, y0, s.z0, s.x1 + SKIN, y1, s.z1);
    }
  };
  skin(B, layout.solids, 0);
  skin(E, groundLayout.solids, GY);

  // ======== FIRST FLOOR, left: taupe box with balcony, cream cladding, wood fins ========
  // bottom slab fascia and wood soffit with downlights
  B.box(M.taupe, XL, -0.45, 18.35, 4.95, 0.2, 18.57);
  B.box(M.woodSoft, XL, g1 - 0.17, GFRONT, 4.95, g1 - 0.15, 18.57);
  for (const x of [0.9, 2.4, 3.8]) B.box(M.lampGlow, x - 0.07, g1 - 0.19, 18.05, x + 0.07, g1 - 0.15, 18.19);
  // frame: left post, top beam, roof-slab edge band (bronze) and white lip
  B.box(M.taupe, XL, -0.45, 18.35, 0.32, 2.9, 18.57);
  B.box(M.taupe, XL, 2.4, 18.35, 4.95, 2.9, 18.57);
  B.box(M.bronze, XL - 0.1, 2.9, 18.3, 5.05, 3.22, 18.62);
  B.box(M.white, XL - 0.14, 3.22, 18.28, 5.09, 3.3, 18.66);
  // cream cladding with horizontal grooves beside the balcony opening (bath front)
  for (let y = 0.45; y < 2.4; y += 0.42) B.box(M.cladLine, 0.34, y, 18.43, 1.38, y + 0.025, 18.45);
  // vertical wood fins
  for (let i = 0; i < 6; i++) B.box(M.finWood, 1.42 + i * 0.1, 0.2, 18.41, 1.48 + i * 0.1, 2.4, 18.55);
  // soffit lights inside the balcony box
  for (const x of [1.7, 2.9, 4.1]) B.box(M.lampGlow, x - 0.07, 2.37, 18.0, x + 0.07, 2.4, 18.14);

  // ======== FIRST FLOOR, right: terrace with glass railing, wood-soffit canopies ========
  // terrace slab edge: white top, bronze band below, wood soffit and downlights
  B.box(M.white, 4.95, -0.2, 18.3, XR + 0.1, 0.0, 18.57);
  B.box(M.bronze, 4.95, -0.42, 18.3, XR + 0.1, -0.2, 18.57);
  B.box(M.woodSoft, 4.95, g1 - 0.17, GFRONT, XR + 0.1, g1 - 0.15, 18.57);
  for (const x of [6.1, 7.2, 8.3, 9.4]) B.box(M.lampGlow, x - 0.07, g1 - 0.19, 18.05, x + 0.07, g1 - 0.15, 18.19);
  // roof canopy over the entrance side: bronze fascia band, white lip, wood soffit with downlights
  B.box(M.bronze, 4.95, 2.9, 18.3, 7.75, 3.22, 18.57);
  B.box(M.white, 4.95, 3.22, 18.28, 7.75, 3.3, 18.62);
  B.box(M.woodSoft, 4.95, 2.98, RFRONT, 7.75, 3.0, 18.57);
  for (const [x, z] of [[5.6, 18.0], [6.4, 18.25], [7.1, 18.0], [6.8, 17.85], [5.9, 17.85]]) B.box(M.lampGlow, x - 0.07, 2.96, z - 0.07, x + 0.07, 2.98, z + 0.07);
  // bronze feature column with light grooves (from the ground to the roof band)
  E.box(M.bronze, 4.4, g0, 17.35, 5.55, 3.22, 18.6);
  for (let y = 0.45; y < 2.9; y += 0.6) E.box(M.cream, 4.42, y, 18.6, 5.53, y + 0.03, 18.62);

  // ======== ROOF ========
  const roofShape = new THREE.Shape(shape.getPoints());
  roofShape.holes = shape.holes;
  const rg = new THREE.ExtrudeGeometry(roofShape, { depth: 0.2, bevelEnabled: false });
  rg.rotateX(Math.PI / 2);
  rg.translate(0, H + 0.22, 0);
  const roofMesh = new THREE.Mesh(rg, M.white);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  roofGroup.add(roofMesh);
  const py0 = H + 0.22;
  // perimeter parapet (bronze) at the back and sides; front parapets are set back from the roof edge
  R.box(M.bronze, XL, py0, -0.115, XR, py0 + 0.55, 0.05);
  R.box(M.bronze, XL, py0, -0.115, XL + 0.17, py0 + 0.55, LFRONT);
  R.box(M.bronze, XR - 0.17, py0, -0.115, XR, py0 + 0.55, RFRONT);
  R.box(M.bronze, 0.37, py0, 17.1, 4.2, py0 + 0.55, 17.3); // front parapet, left (tall)
  R.box(M.bronze, 5.6, py0, 17.1, 7.7, py0 + 0.35, 17.3); // front parapet, right (low)
  // wood louvre block between them
  R.box(M.bronze, 4.2, py0, 17.1, 5.6, py0 + 0.95, 17.3);
  for (let i = 0; i < 14; i++) R.box(M.louver, 4.22 + i * 0.1, py0, 17.3, 4.28 + i * 0.1, py0 + 0.95, 17.38);
  R.box(M.bronze, 4.2, py0 + 0.95, 17.1, 5.6, py0 + 1.02, 17.4);
  // white fascia lips at the edges
  R.box(M.white, XL - 0.12, py0 - 0.05, -0.235, XR + 0.12, py0, -0.1);
  R.box(M.white, XL - 0.12, py0 - 0.05, -0.235, XL, py0, LFRONT + 0.12);
  R.box(M.white, XR, py0 - 0.05, -0.235, XR + 0.12, py0, RFRONT + 0.12);
  R.box(M.white, 7.75, py0 - 0.05, RFRONT, XR + 0.12, py0, RFRONT + 0.12);

  // ======== STAIR TOWER: slanted taupe side wall, full-height glazing, slot vents, white roof slab ========
  const tx0 = 7.6, tx1 = XR, tz0 = 12.98, ty0 = py0, ty1 = 4.3;
  R.box(M.taupe, tx0, ty0, tz0, tx0 + 0.2, ty1, RFRONT); // west wall
  R.box(M.taupe, tx1 - 0.2, ty0, tz0, tx1, ty1, RFRONT); // east wall
  R.box(M.taupe, tx0, ty0, tz0, tx1, ty1, tz0 + 0.2); // back wall
  R.box(M.taupe, 10.2, ty0, RFRONT - 0.25, tx1, ty1, RFRONT); // right pier
  R.box(M.taupe, 8.2, ty1 - 0.55, RFRONT - 0.25, 10.2, ty1, RFRONT); // header over the glass
  // slanted left pier: front face is a trapezoid rising to the left
  const sp = new THREE.Shape();
  sp.moveTo(7.0, ty0); sp.lineTo(8.2, ty0); sp.lineTo(8.2, 4.45); sp.lineTo(7.7, 4.45); sp.closePath();
  const sg = new THREE.ExtrudeGeometry(sp, { depth: 0.25, bevelEnabled: false });
  sg.translate(0, 0, RFRONT - 0.25);
  const slant = new THREE.Mesh(sg, M.taupe); // extruded shapes are not indexed, so this one stays a separate mesh
  slant.castShadow = true;
  slant.receiveShadow = true;
  roofGroup.add(slant);
  R.box(M.white, tx0 - 0.1, ty1, tz0 - 0.1, tx1 + 0.12, ty1 + 0.15, RFRONT + 0.12); // thin white roof slab
  // glazing frame: mullions, ceiling-level transom, top rail (the lower glazing comes from the first-floor wall)
  for (const x of [8.2, 9.2, 10.2]) R.box(M.alu, x - 0.03, 0, RFRONT - 0.15, x + 0.03, ty1 - 0.55, RFRONT - 0.05);
  R.box(M.alu, 8.2, 2.97, RFRONT - 0.15, 10.2, 3.05, RFRONT - 0.05);
  R.box(M.alu, 8.2, ty1 - 0.6, RFRONT - 0.15, 10.2, ty1 - 0.55, RFRONT - 0.05);
  // two slot vents with louvre lines at the top of the glazing
  for (const [a, b] of [[8.3, 9.1], [9.3, 10.1]]) {
    R.box(M.alu, a, ty1 - 0.5, RFRONT - 0.16, b, ty1 - 0.28, RFRONT - 0.04);
    for (let x = a + 0.06; x < b - 0.04; x += 0.07) R.box(M.black, x, ty1 - 0.46, RFRONT - 0.17, x + 0.025, ty1 - 0.32, RFRONT - 0.14);
  }
  // spot lights inside the tower
  for (const x of [8.7, 9.7]) R.box(M.lampGlow, x - 0.05, ty1 - 0.9, RFRONT - 0.4, x + 0.05, ty1 - 0.86, RFRONT - 0.3);
  const TG = new Batch();
  TG.box(M.glass, 8.2, ty0, RFRONT - 0.12, 10.2, ty1 - 0.55, RFRONT - 0.1);

  // ======== GROUND FLOOR FRONT, boundary wall, pillars, gates (all on the plot line) ========
  E.box(M.taupe, 1.7, g0 + 2.5, GFRONT, 4.3, g0 + 2.58, GFRONT + 0.06); // lintel band over the drawing-room window
  E.box(M.woodSoft, 4.4, g1 - 0.02, GFRONT, XR + 0.1, g1, GZ); // soffit between the facade and the gate line (under the overhang)
  // planter wall with hedge, framed slat panel, niche and lights
  E.box(M.cream, XL - 0.1, g0, GZ - 0.1, 5.2, g0 + 1.5, GZ + 0.1);
  E.box(M.cream, XL - 0.14, g0 + 1.5, GZ - 0.13, 5.24, g0 + 1.58, GZ + 0.13);
  for (const [a, b] of [[-0.1, 0.95], [1.9, 5.0]]) hedge( a, g0 + 1.58, GZ - 0.1, b, g0 + 1.9, GZ + 0.1);
  slatPanel(M, E, 1.17, 4.7, g0 + 0.12, g0 + 1.32, GZ + 0.1, GZ + 0.14, false);
  E.box(M.niche, 0.37, g0 + 0.12, GZ + 0.1, 0.67, g0 + 1.32, GZ + 0.12);
  E.box(M.lampGlow, 0.49, g0 + 0.2, GZ + 0.12, 0.55, g0 + 1.25, GZ + 0.13);
  for (const x of [2.2, 3.0, 3.9]) E.box(M.lampGlow, x - 0.07, g0 + 1.4, GZ + 0.1, x + 0.07, g0 + 1.44, GZ + 0.13);
  // pillars with cap, planter and wall light
  for (const [a, b] of [[5.2, 5.7], [10.25, 10.8]]) {
    E.box(M.bronze, a, g0, GZ - 0.25, b, g0 + 1.9, GZ + 0.25);
    E.box(M.cream, a - 0.05, g0 + 1.9, GZ - 0.3, b + 0.05, g0 + 2.02, GZ + 0.3);
    E.box(M.cream, a + 0.02, g0 + 2.02, GZ - 0.22, b - 0.02, g0 + 2.4, GZ + 0.22);
    hedge( a + 0.05, g0 + 2.4, GZ - 0.2, b - 0.05, g0 + 2.62, GZ + 0.2);
    E.box(M.lampGlow, (a + b) / 2 - 0.06, g0 + 1.2, GZ + 0.25, (a + b) / 2 + 0.06, g0 + 1.6, GZ + 0.28);
  }
  // pedestrian gate (open, swung out), fixed vertical-bar panel, sliding gate in two leaves
  const gy0 = g0 + 0.08, gy1 = g0 + 1.65;
  // pedestrian gate: a hinged leaf that is shut in the elevation and swings open when someone walks up to it
  const gateGroup = new THREE.Group();
  gateGroup.position.set(5.7, 0, GZ);
  const GB = new Batch();
  slatPanel(M, GB, 0.0, 0.9, gy0, gy1, -0.04, 0.06, false);
  GB.box(M.steel, 0.78, g0 + 0.7, 0.06, 0.82, g0 + 1.4, 0.09); // handle
  GB.flush(gateGroup, { cast: false, receive: false });
  extGroup.add(gateGroup);
  const gateRect = rect(5.7, GZ - 0.04, 6.6, GZ + 0.06);
  const gate = {
    cx: 6.15, cz: GZ, angle: 0, target: 0,
    setOpen(on) {
      this.target = on ? 1 : 0;
      const r = gateRect;
      if (on) { r.x0 = 5.7; r.x1 = 5.78; r.z0 = GZ + 0.05; r.z1 = GZ + 0.95; } else { r.x0 = 5.7; r.x1 = 6.6; r.z0 = GZ - 0.04; r.z1 = GZ + 0.06; }
    },
    update(dt) {
      this.angle += (this.target - this.angle) * Math.min(1, dt * 5);
      gateGroup.rotation.y = -this.angle * Math.PI * 0.5;
    },
  };
  slatPanel(M, E, 6.6, 7.05, gy0, gy1, GZ - 0.04, GZ + 0.04, true);
  slatPanel(M, E, 7.05, 8.65, gy0, gy1, GZ - 0.04, GZ + 0.06, false);
  // sliding gate, right leaf: slides open behind the fixed leaf when someone walks up to it
  const slideGroup = new THREE.Group();
  slideGroup.position.set(8.65, 0, GZ);
  const SB = new Batch();
  slatPanel(M, SB, 0.0, 1.6, gy0, gy1, -0.04, 0.06, false);
  SB.flush(slideGroup, { cast: false, receive: false });
  extGroup.add(slideGroup);
  const slideRect = rect(8.65, GZ - 0.04, 10.25, GZ + 0.06);
  const slide = {
    cx: 9.4, cz: GZ, angle: 0, target: 0,
    setOpen(on) {
      this.target = on ? 1 : 0;
      const r = slideRect;
      if (on) { r.x0 = 7.1; r.x1 = 8.7; r.z0 = GZ - 0.16; r.z1 = GZ - 0.06; } else { r.x0 = 8.65; r.x1 = 10.25; r.z0 = GZ - 0.04; r.z1 = GZ + 0.06; }
    },
    update(dt) {
      this.angle += (this.target - this.angle) * Math.min(1, dt * 4);
      slideGroup.position.set(8.65 - 1.55 * this.angle, 0, GZ - 0.11 * this.angle);
    },
  };
  E.box(M.steel, 7.0, g0 + 0.6, GZ + 0.06, 7.04, g0 + 1.4, GZ + 0.09); // long handle
  // paving: driveway apron and the strip under the overhang
  E.box(M.paving, 4.4, g0, GFRONT, 11.0, g0 + 0.04, 23.5);
  E.box(M.paving, XL - 0.4, g0, GFRONT, 4.4, g0 + 0.04, GZ);

  // ======== street: footpath, kerb, asphalt road with centre line, trees, street lamps, parked car ========
  E.box(M.paving, -30, g0, GFRONT, 40, g0 + 0.04, 22.0); // footpath
  E.box(M.kerb, -30, g0, 22.0, 40, g0 + 0.15, 22.25); // kerb stone
  E.box(M.asphalt, -30, g0, 22.25, 40, g0 + 0.02, 60);
  for (let x = -29; x < 39; x += 3) E.box(M.roadLine, x, g0 + 0.021, 27.35, x + 1.5, g0 + 0.023, 27.5); // dashed centre line
  let treeSeed = 100;
  const tree = (x, z, s) => {
    E.box(M.trunk, x - 0.1 * s, g0, z - 0.1 * s, x + 0.1 * s, g0 + 2.4 * s, z + 0.1 * s);
    for (const [dx, dy, dz] of [[0.6, 2.6, 0.2], [-0.6, 2.5, -0.2]]) E.box(M.trunk, x + dx * s * 0.5 - 0.04 * s, g0 + 2.0 * s, z + dz * s * 0.5 - 0.04 * s, x + dx * s * 0.5 + 0.04 * s, g0 + dy * s, z + dz * s * 0.5 + 0.04 * s);
    cards(E, M, x, g0 + 3.6 * s, z, 1.7 * s, 1.3 * s, 1.7 * s, 260, 0.62 * s, treeSeed++);
  };
  const lamp = (x, z) => {
    E.box(M.pole, x - 0.06, g0, z - 0.06, x + 0.06, g0 + 5.0, z + 0.06);
    E.box(M.pole, x - 0.06, g0 + 4.95, z - 1.1, x + 0.06, g0 + 5.05, z + 0.06);
    E.box(M.lampGlow, x - 0.2, g0 + 4.9, z - 1.2, x + 0.2, g0 + 4.95, z - 0.85);
  };
  lamp(12.5, 21.7); lamp(-1.2, 21.7);
  // parked car, bonnet to the right (rounded bodywork, rims, mirrors, lights)
  const car = (cx, cz) => {
    const rb = (mat, x, y, z, sx, sy, sz, r) => {
      const g = new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(r, sx / 2 - 1e-3, sy / 2 - 1e-3, sz / 2 - 1e-3));
      g.translate(cx + x, g0 + y, cz + z);
      E.add(mat, worldUV(g));
    };
    rb(M.carPaint, 0, 0.55, 0, 4.3, 0.52, 1.76, 0.18); // lower body
    rb(M.carPaint, -0.15, 1.08, 0, 2.2, 0.5, 1.5, 0.2); // cabin
    rb(M.carPaint, 1.5, 0.84, 0, 1.1, 0.06, 1.62, 0.03); // bonnet panel
    rb(M.carGlass, -0.15, 1.1, -0.755, 1.95, 0.4, 0.02, 0.05); rb(M.carGlass, -0.15, 1.1, 0.755, 1.95, 0.4, 0.02, 0.05); // side glass
    rb(M.carGlass, 0.93, 1.1, 0, 0.03, 0.4, 1.28, 0.05); rb(M.carGlass, -1.23, 1.1, 0, 0.03, 0.4, 1.28, 0.05); // screens
    rb(M.headlight, 2.14, 0.64, -0.62, 0.06, 0.1, 0.3, 0.03); rb(M.headlight, 2.14, 0.64, 0.62, 0.06, 0.1, 0.3, 0.03);
    rb(M.tailLight, -2.14, 0.66, -0.62, 0.06, 0.12, 0.34, 0.03); rb(M.tailLight, -2.14, 0.66, 0.62, 0.06, 0.12, 0.34, 0.03);
    rb(M.carPaint, 0.95, 0.98, -0.93, 0.18, 0.1, 0.1, 0.03); rb(M.carPaint, 0.95, 0.98, 0.93, 0.18, 0.1, 0.1, 0.03); // mirrors
    rb(M.rubber, 2.12, 0.34, 0, 0.1, 0.12, 1.5, 0.04); rb(M.rubber, -2.12, 0.34, 0, 0.1, 0.12, 1.5, 0.04); // bumpers
    for (const wx of [-1.3, 1.35]) for (const wz of [-0.82, 0.82]) {
      const tg = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18); tg.rotateX(Math.PI / 2); tg.translate(cx + wx, g0 + 0.34, cz + wz); E.add(M.rubber, worldUV(tg));
      const rg2 = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 12); rg2.rotateX(Math.PI / 2); rg2.translate(cx + wx, g0 + 0.34, cz + wz); E.add(M.steel, worldUV(rg2));
    }
  };
  car(9.4, 24.6);

  // ======== neighbours ========
  const N = new Batch();
  N.box(M.concrete, -5.2, GY, 1.0, -0.45, GY + 3.2, 18.2);
  N.box(M.brick, -5.2, GY + 3.2, 1.0, -0.45, GY + 6.4, 18.2);
  N.box(M.plasterGrey, 11.0, GY, 3.0, 15.5, GY + 6.0, 18.2);
  N.box(M.brick, 15.5, GY, 3.0, 20, GY + 6.8, 18.2);
  for (const [x0, x1, y0, y1] of [[-4.4, -3.2, 1.0, 2.2], [-2.6, -1.4, 1.0, 2.2], [-4.4, -3.2, 4.4, 5.6], [-2.6, -1.4, 4.4, 5.6]]) {
    N.box(M.bronze, x0 - 0.06, GY + y0 - 0.06, 18.2, x1 + 0.06, GY + y1 + 0.06, 18.27);
    N.box(M.carGlass, x0, GY + y0, 18.27, x1, GY + y1, 18.29);
    N.box(M.bronze, (x0 + x1) / 2 - 0.02, GY + y0, 18.27, (x0 + x1) / 2 + 0.02, GY + y1, 18.31);
  }
  for (const [x0, x1, y0, y1] of [[12.0, 13.1, 1.2, 2.4], [14.0, 15.1, 1.2, 2.4], [12.0, 13.1, 3.8, 5.0], [14.0, 15.1, 3.8, 5.0]]) {
    N.box(M.white, x0 - 0.07, GY + y0 - 0.07, 18.2, x1 + 0.07, GY + y1 + 0.07, 18.26);
    N.box(M.carGlass, x0, GY + y0, 18.26, x1, GY + y1, 18.28);
  }
  N.box(M.steel, 12.3, GY + 6.0, 17.2, 13.3, GY + 6.5, 18.0); // roof water tank and AC unit
  N.box(M.black, 12.4, GY + 6.5, 17.3, 13.2, GY + 6.62, 17.9);

  // ======== ground plane ========
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), M.sand);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(5.2, GY - 0.01, 10);
  ground.receiveShadow = true;
  extGroup.add(ground);

  // ---- glowing lights, as in the elevation: a halo at every downlight, wall light and spot
  const halo = new THREE.SpriteMaterial({ map: haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
  const glow = (group, x, y, z, s = 0.5) => {
    const sp = new THREE.Sprite(halo);
    sp.position.set(x, y, z);
    sp.scale.set(s, s, 1);
    group.add(sp);
  };
  const dy = g1 - 0.2;
  for (const x of [0.9, 2.4, 3.8]) glow(firstGroup, x, dy, 18.12); // under the left box
  for (const x of [1.7, 2.9, 4.1]) glow(firstGroup, x, 2.34, 18.07); // inside the balcony box
  for (const x of [6.1, 7.2, 8.3, 9.4]) glow(firstGroup, x, dy, 18.12); // under the terrace
  for (const [x, z] of [[5.6, 18.0], [6.4, 18.25], [7.1, 18.0], [6.8, 17.85], [5.9, 17.85]]) glow(firstGroup, x, 2.93, z); // canopy
  for (const x of [2.2, 3.0, 3.9]) glow(extGroup, x, g0 + 1.42, GZ + 0.2, 0.45); // planter wall
  glow(extGroup, 0.52, g0 + 0.75, GZ + 0.25, 0.7); // niche
  for (const x of [5.45, 10.525]) glow(extGroup, x, g0 + 1.4, GZ + 0.36, 0.65); // pillar wall lights
  for (const x of [8.7, 9.7]) glow(roofGroup, x, 4.3 - 0.88, RFRONT - 0.35, 0.6); // tower spots

  B.flush(firstGroup);
  E.flush(extGroup);
  N.flush(extGroup);
  R.flush(roofGroup);
  TG.flush(roofGroup, { cast: false, receive: false });

  // ---- collision for the street side (ground level), and the column that also meets the first-floor terrace
  const rects = [
    rect(XL - 0.1, GZ - 0.1, 5.2, GZ + 0.1), // planter wall
    rect(5.2, GZ - 0.25, 5.7, GZ + 0.25), rect(10.25, GZ - 0.25, 10.8, GZ + 0.25), // pillars
    gateRect, // pedestrian gate (shut or swung open)
    rect(6.6, GZ - 0.04, 8.65, GZ + 0.06), // vertical-bar panel and fixed gate leaf
    slideRect, // sliding gate leaf (shut or slid open)
    rect(4.4, 17.35, 5.55, 18.6, -99, 99), // bronze feature column (ground to roof)
    rect(-5.2, 1.0, -0.45, 18.2), rect(11.0, 3.0, 20, 18.2), // neighbours
    rect(-3.4, 18.7, -3.2, 31.6), rect(13.6, 18.7, 13.8, 31.6), rect(-3.4, 31.4, 13.8, 31.6), // street limits
    rect(-2.4, 20.0, -2.0, 20.4), rect(12.4, 20.0, 12.8, 20.4), // tree trunks
    rect(7.25, 23.7, 11.55, 25.5), // parked car
    rect(12.44, 21.64, 12.56, 21.76), rect(-1.26, 21.64, -1.14, 21.76), // lamp posts
  ];
  return { rects, gate, gates: [gate, slide] };
}
