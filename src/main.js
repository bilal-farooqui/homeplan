import * as THREE from 'three';
import first from './data/floorplan.json';
import ground from './data/floorplan-ground.json';
import { makeMaterials } from './materials.js';
import { buildScene, FLOOR_H, skyEnvironments } from './scene.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { roomAt } from './layout.js';
import { loadAssets } from './assets.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const mobile = isTouch || Math.min(screen.width, screen.height) < 700;
if (isTouch) document.body.classList.add('touch');

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // the scene is static: shadows are rendered once, and again when visibility changes
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const M = makeMaterials(renderer, mobile);
const S = buildScene(first, ground, M, { mobile });
const { scene, rects, updateLights } = S;
// reflections come from the same sky as the background
const ENV = skyEnvironments(renderer);
scene.environment = ENV.day;
scene.environmentIntensity = 0.35;
const L1 = S.levels.first, L0 = S.levels.ground;
let A = { ready: false, apply: () => false }; // photographic assets (textures, HDRI sky, models), loaded in the background
const plans = { 1: first, 0: ground }; // lv 1 = first floor, lv 0 = ground floor
const levelOf = { 1: L1, 0: L0 };

const fp = first.footprint;
const W = fp.x1 - fp.x0, D = fp.z1 - fp.z0, H = first.ceilingHeight;
const CX = (fp.x0 + fp.x1) / 2, CZ = (fp.z0 + fp.z1) / 2;
const EYE = first.eyeHeight, RADIUS = 0.22, Y0 = -FLOOR_H;

loadAssets({ renderer, scene, S, M, mobile, plans: { first, ground } }).then((r) => {
  if (!r) return;
  A = r;
  if (A.ready) A.apply(night);
  lighting();
  renderer.shadowMap.needsUpdate = true;
}).catch((e) => console.warn('assets', e));

// ---- cameras
const cam = new THREE.PerspectiveCamera(72, 1, 0.05, 80);
cam.rotation.order = 'YXZ';
const topCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
topCam.up.set(0, 0, -1);
topCam.position.set(CX, 40, CZ);
topCam.lookAt(CX, 0, CZ);

// ---- ambient occlusion (desktop only): soft shading in corners, under furniture and where surfaces meet
let composer = null, renderPass = null, gtao = null;
if (!mobile && !location.search.includes('ao=0')) {
  try {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, cam);
    composer.addPass(renderPass);
    gtao = new GTAOPass(scene, cam, innerWidth, innerHeight);
    gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.5, scale: 1.1, samples: 10 });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
  } catch (err) { console.warn('ambient occlusion unavailable', err); composer = null; }
}

// ---- state
const st = first.start;
const player = { x: st.x, z: st.y, yaw: (st.yawDeg * Math.PI) / 180, pitch: 0, lv: st.lv ?? 1, y: 0, feet: 0, inStair: false };
player.feet = player.y = player.lv === 1 ? 0 : Y0;
let topView = false; // top-down plan of the current floor
let outView = false; // outside, orbiting the house
const orbit = { az: 0, el: 0.0, dist: 22.5, tx: 5.3, ty: -1.6, tz: 17.5 };
const keys = new Set();
const joy = { x: 0, y: 0 };

// ---- the staircase between the floors (walkable; height follows the steps)
const gs = ground.stairs;
function stairHeight(x, z) {
  for (const l of gs.landings) {
    const r = l.rect;
    if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return Y0 + l.index * gs.rise;
  }
  for (const f of gs.flights) {
    const n = f.steps, td = Math.abs(f.to - f.from) / n;
    const lo = Math.min(f.from, f.to), hi = Math.max(f.from, f.to);
    if (f.axis === 'z' && x >= f.x0 && x <= f.x1 && z >= lo && z <= hi) return Y0 + (f.start + Math.min(n - 1, Math.floor(Math.abs(f.from - z) / td)) + 1) * gs.rise;
    if (f.axis === 'x' && z >= f.z0 && z <= f.z1 && x >= lo && x <= hi) return Y0 + (f.start + Math.min(n - 1, Math.floor(Math.abs(f.from - x) / td)) + 1) * gs.rise;
  }
  return null;
}
function updateGate() {
  // the pedestrian gate opens when the player is at street level close to it
  for (const gt of S.gates) gt.setOpen(player.lv === 0 && !outView && Math.hypot(player.x - gt.cx, player.z - gt.cz) < 3.6);
}
function updateFloor() {
  updateGate();
  const h = stairHeight(player.x, player.z);
  const inStair = h !== null;
  if (!inStair && player.inStair) player.lv = player.z < 15.5 ? 1 : 0; // left the stair at the top (north end) or at its foot (south end)
  player.inStair = inStair;
  player.feet = inStair ? h : player.lv === 1 ? 0 : Y0;
}

// ---- collision (circle vs axis-aligned rectangles that apply at the player's floor height)
function resolve(px, pz, feet) {
  for (let it = 0; it < 3; it++) {
    for (const r of rects) {
      if (feet < r.f0 || feet > r.f1) continue;
      if (px + RADIUS < r.x0 || px - RADIUS > r.x1 || pz + RADIUS < r.z0 || pz - RADIUS > r.z1) continue;
      const cx = Math.max(r.x0, Math.min(px, r.x1));
      const cz = Math.max(r.z0, Math.min(pz, r.z1));
      const dx = px - cx, dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * RADIUS;
        pz = cz + (dz / d) * RADIUS;
      } else {
        const l = px - r.x0, rr = r.x1 - px, t = pz - r.z0, b = r.z1 - pz;
        const m = Math.min(l, rr, t, b);
        if (m === l) px = r.x0 - RADIUS; else if (m === rr) px = r.x1 + RADIUS; else if (m === t) pz = r.z0 - RADIUS; else pz = r.z1 + RADIUS;
      }
    }
  }
  return [px, pz];
}

function move(dt) {
  let f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - joy.y;
  let r = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joy.x;
  const turn = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0);
  player.yaw -= turn * 1.6 * dt;
  const len = Math.hypot(f, r);
  if (len < 0.01) return;
  if (len > 1) { f /= len; r /= len; }
  const speed = keys.has('shift') ? 3.2 : 1.8;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const vx = (-sy * f + cy * r) * speed * dt;
  const vz = (-cy * f - sy * r) * speed * dt;
  const steps = Math.max(1, Math.ceil(Math.hypot(vx, vz) / 0.08));
  for (let i = 0; i < steps; i++) {
    const [nx, nz] = resolve(player.x + vx / steps, player.z + vz / steps, player.feet);
    player.x = nx; player.z = nz;
    updateFloor();
  }
}

// ---- input: keyboard
addEventListener('keydown', (e) => { keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

// ---- input: drag to look (mouse or touch); in the outside view, drag to orbit and pinch / wheel to zoom
const looks = new Map();
let pinch = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (topView) return;
  canvas.setPointerCapture(e.pointerId);
  looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.classList.add('drag');
});
canvas.addEventListener('pointermove', (e) => {
  const p = looks.get(e.pointerId);
  if (!p) return;
  const k = e.pointerType === 'touch' ? 0.0055 : 0.0035;
  if (outView) {
    if (looks.size === 2) {
      const [a, b] = [...looks.values()];
      p.x = e.clientX; p.y = e.clientY;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) orbit.dist = Math.max(8, Math.min(70, orbit.dist * (pinch / d)));
      pinch = d;
      return;
    }
    orbit.az -= (e.clientX - p.x) * k * 1.1;
    orbit.el = Math.max(0.02, Math.min(1.45, orbit.el + (e.clientY - p.y) * k));
    p.x = e.clientX; p.y = e.clientY;
    return;
  }
  player.yaw -= (e.clientX - p.x) * k;
  player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - (e.clientY - p.y) * k));
  p.x = e.clientX; p.y = e.clientY;
});
const endLook = (e) => { pinch = 0; looks.delete(e.pointerId); if (!looks.size) canvas.classList.remove('drag'); };
canvas.addEventListener('wheel', (e) => { if (outView) { e.preventDefault(); orbit.dist = Math.max(8, Math.min(70, orbit.dist * (1 + e.deltaY * 0.001))); } }, { passive: false });
canvas.addEventListener('pointerup', endLook);
canvas.addEventListener('pointercancel', endLook);

const joyEl = document.getElementById('joy');
const knob = joyEl.querySelector('.knob');
let joyId = null;
function joyMove(e) {
  const b = joyEl.getBoundingClientRect();
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const max = b.width / 2 - 10;
  const d = Math.hypot(dx, dy);
  if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / max; joy.y = dy / max;
}
joyEl.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); e.stopPropagation(); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; joy.x = joy.y = 0; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', joyEnd);
joyEl.addEventListener('pointercancel', joyEnd);

// ---- HUD: room name, minimap (one per floor), labels for the top view
const roomEl = document.getElementById('room');
let lastText = '';
const mapWrap = document.getElementById('map');
const mapCanvas = mapWrap.querySelector('canvas');
const mapW = innerWidth < 520 ? 82 : 110;
const mapScale = mapW / W;
const mapH = Math.round(D * mapScale);
const dpr = Math.min(devicePixelRatio || 1, 2);
mapCanvas.width = mapW * dpr; mapCanvas.height = mapH * dpr;
mapCanvas.style.width = mapW + 'px'; mapCanvas.style.height = mapH + 'px';
const mctx = mapCanvas.getContext('2d');

function drawBase(level, plan) {
  const c = document.createElement('canvas');
  c.width = mapCanvas.width; c.height = mapCanvas.height;
  const g = c.getContext('2d');
  g.scale(dpr * mapScale, dpr * mapScale);
  g.translate(-fp.x0, -fp.z0);
  for (const r of plan.rooms) {
    if (r.noFloor) continue;
    g.fillStyle = r.void ? '#aebfa3' : r.open ? '#cfd8c4' : '#f4f1ea';
    for (const q of r.rects) g.fillRect(q[0], q[1], q[2] - q[0], q[3] - q[1]);
  }
  g.fillStyle = '#2b2e33';
  for (const s of level.layout.solids) if (s.y1 - s.y0 > 2 || s.sillPiece) g.fillRect(s.x0, s.z0, s.x1 - s.x0, s.z1 - s.z0);
  for (const b of level.layout.blocks) g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
  g.fillStyle = '#8a8f96';
  for (const b of level.layout.slabs) g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
  g.fillStyle = '#2b2e33';
  for (const cc of level.layout.columns) g.fillRect(cc.x0, cc.z0, cc.x1 - cc.x0, cc.z1 - cc.z0);
  g.fillStyle = '#8a8f96';
  for (const r of level.rects) if (r.item) g.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
  g.fillStyle = '#6d6a63';
  const s = plan.stairs;
  for (const f of s.flights) {
    if (f.axis === 'z') g.fillRect(f.x0, Math.min(f.from, f.to), f.x1 - f.x0, Math.abs(f.to - f.from));
    else g.fillRect(Math.min(f.from, f.to), f.z0, Math.abs(f.to - f.from), f.z1 - f.z0);
  }
  for (const l of s.landings) g.fillRect(l.rect[0], l.rect[1], l.rect[2] - l.rect[0], l.rect[3] - l.rect[1]);
  return c;
}
const bases = { 1: drawBase(L1, first), 0: drawBase(L0, ground) };
function drawMap() {
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  mctx.drawImage(bases[player.lv], 0, 0);
  mctx.setTransform(dpr * mapScale, 0, 0, dpr * mapScale, -fp.x0 * dpr * mapScale, -fp.z0 * dpr * mapScale);
  const px = Math.max(fp.x0 + 0.3, Math.min(fp.x1 - 0.3, player.x));
  const pz = Math.max(fp.z0 + 0.3, Math.min(fp.z1 - 0.3, player.z));
  const a = player.yaw;
  mctx.fillStyle = 'rgba(31,111,235,0.35)';
  mctx.beginPath();
  mctx.moveTo(px, pz);
  mctx.arc(px, pz, 1.6, -a - Math.PI / 2 - 0.6, -a - Math.PI / 2 + 0.6);
  mctx.closePath();
  mctx.fill();
  mctx.fillStyle = '#e5322d';
  mctx.strokeStyle = '#fff';
  mctx.lineWidth = 0.12;
  mctx.beginPath(); mctx.arc(px, pz, 0.38, 0, 7); mctx.fill(); mctx.stroke();
}

const labelsEl = document.getElementById('labels');
const labelNodes = [];
for (const lv of [1, 0]) {
  for (const r of plans[lv].rooms) {
    if (r.outdoor) continue;
    const q = r.rects.reduce((best, c) => ((c[2] - c[0]) * (c[3] - c[1]) > (best[2] - best[0]) * (best[3] - best[1]) ? c : best), r.rects[0]);
    const el = document.createElement('span');
    el.textContent = r.name;
    labelsEl.appendChild(el);
    labelNodes.push({ lv, el, x: (q[0] + q[2]) / 2, z: (q[1] + q[3]) / 2 + (r.id === 'lounge' ? 0.4 : 0) });
  }
}
const v3 = new THREE.Vector3();
function placeLabels() {
  for (const l of labelNodes) {
    l.el.style.display = l.lv === player.lv ? '' : 'none';
    if (l.lv !== player.lv) continue;
    v3.set(l.x, 0, l.z).project(topCam);
    l.el.style.left = ((v3.x + 1) / 2) * innerWidth + 'px';
    l.el.style.top = ((1 - v3.y) / 2) * innerHeight + 'px';
  }
}

// ---- view modes: walk -> top view -> outside -> walk
const toggle = document.getElementById('toggle');
const marker = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshBasicMaterial({ color: 0xe5322d }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);

let night = false;
const nightBtn = document.getElementById('night');
function lighting() {
  const out = outView || (lastOutdoor && !topView);
  S.hemi.intensity = night ? (topView ? 0.7 : outView ? 0.3 : 0.1) : topView ? 1.0 : outView ? 0.1 : 0.15;
  S.fill.intensity = night ? (out ? 0.3 : 0) : out ? 0.6 : 0;
  renderer.toneMappingExposure = S.exposure.value;
  if (!A.ready) scene.environment = night ? ENV.night : ENV.day;
  scene.environmentIntensity = A.ready ? (night ? 0.7 : outView ? 0.55 : 0.7) : night ? 0.45 : outView ? 0.26 : 0.33;
}
let lastOutdoor = false;
function setNight(on) {
  night = on;
  S.setNight(on);
  if (A.ready) A.apply(on);
  document.body.classList.toggle('dark', on);
  nightBtn.textContent = on ? 'Day view' : 'Night view';
  lighting();
  renderer.shadowMap.needsUpdate = true;
}
nightBtn.addEventListener('click', () => setNight(!night));
nightBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

const NEXT = { walk: 'Top view', top: 'Outside', out: 'Walk' };
let mode = 'walk';
function applyVisibility() {
  const onFirst = player.lv === 1;
  L1.group.visible = !(topView && !onFirst);
  L1.ceilGroup.visible = !topView && !(topView && !onFirst);
  L0.ceilGroup.visible = !topView;
  L0.group.visible = true;
  M.wall.color.set(topView ? 0x5d6269 : 0xf1ece2); // dark wall tops make the plan readable from above
  renderer.shadowMap.needsUpdate = true; // visibility changes what casts shadows
}
function setMode(next) {
  mode = next;
  topView = next === 'top';
  outView = next === 'out';
  updateGate();
  document.body.classList.toggle('top', topView);
  document.body.classList.toggle('out', outView);
  toggle.textContent = NEXT[next];
  marker.visible = topView;
  lighting();
  applyVisibility();
  resize();
}
const setTop = (on) => setMode(on ? 'top' : 'walk');
toggle.addEventListener('click', () => setMode(mode === 'walk' ? 'top' : mode === 'top' ? 'out' : 'walk'));
toggle.addEventListener('pointerdown', (e) => e.stopPropagation());

// ---- resize
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  cam.aspect = w / h;
  cam.fov = outView ? (w / h < 1 ? 50 : 32) : w / h < 1 ? 82 : 72;
  cam.far = outView ? 200 : 80;
  if (outView) cam.setViewOffset(w, h, 0, -Math.round(h * 0.15), w, h); else cam.clearViewOffset(); // outside view: low camera, building framed like the elevation
  cam.updateProjectionMatrix();
  const pw = W + 0.6, ph = D + 0.6;
  const a = w / h;
  let hw, hh;
  if (a > pw / ph) { hh = ph / 2; hw = hh * a; } else { hw = pw / 2; hh = hw / a; }
  topCam.left = -hw; topCam.right = hw; topCam.top = hh; topCam.bottom = -hh;
  topCam.position.set(CX, 40, CZ);
  topCam.lookAt(CX, 0, CZ);
  topCam.updateProjectionMatrix();
  if (topView) placeLabels();
}
addEventListener('resize', resize);
resize();

// ---- loop
let last = performance.now(), mapT = 0, lastLv = player.lv;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!topView && !outView) move(dt);
  if (player.lv !== lastLv) { lastLv = player.lv; if (topView) { applyVisibility(); placeLabels(); } }
  for (const gt of S.gates) gt.update(dt);
  player.y += (player.feet - player.y) * Math.min(1, dt * 12);
  const room = roomAt(plans[player.lv], player.x, player.z);
  if (room) {
    const text = room.outdoor ? room.name : `${room.name} · ${player.lv === 1 ? 'First floor' : 'Ground floor'}`;
    if (text !== lastText) { lastText = text; roomEl.textContent = text; }
  }
  if (outView) {
    const ce = Math.cos(orbit.el);
    cam.position.set(orbit.tx + Math.sin(orbit.az) * ce * orbit.dist, orbit.ty + Math.sin(orbit.el) * orbit.dist, orbit.tz + Math.cos(orbit.az) * ce * orbit.dist);
    cam.lookAt(orbit.tx, orbit.ty, orbit.tz);
  } else {
    cam.position.set(player.x, player.y + EYE, player.z);
    cam.rotation.set(player.pitch, player.yaw, 0);
  }
  const od = !!(room && room.outdoor);
  if (od !== lastOutdoor) { lastOutdoor = od; lighting(); } // light the street facade when outdoors
  if (outView) updateLights(orbit.tx, orbit.ty, orbit.tz, true); else updateLights(player.x, player.y, player.z, topView);
  marker.position.set(player.x, player.lv === 1 ? H + 0.5 : Y0 + H + 0.5, player.z);
  mapT += dt;
  if (mapT > 0.05) { mapT = 0; drawMap(); }
  if (composer && !topView) {
    renderPass.camera = cam; gtao.camera = cam;
    composer.render();
  } else renderer.render(scene, topView ? topCam : cam);
  requestAnimationFrame(frame);
}
renderer.shadowMap.needsUpdate = true;
requestAnimationFrame(frame);

// Hook for automated checks.
window.__walk = {
  scene, S, M,
  pick() { // what is under the centre of the screen (for checking)
    cam.position.set(player.x, player.y + EYE, player.z); cam.rotation.set(player.pitch, player.yaw, 0); cam.updateMatrixWorld(true);
    const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(0, 0), cam);
    const h = rc.intersectObjects(scene.children, true).filter((x) => x.object.isMesh && x.object.visible)[0];
    if (!h) return null;
    return { key: Object.keys(M).find((k) => M[k] === h.object.material), point: h.point.toArray().map((v) => +v.toFixed(2)) };
  },
  player,
  setPlayer(x, z, yawDeg = 0, pitchDeg = 0, lv) {
    player.x = x; player.z = z; player.yaw = (yawDeg * Math.PI) / 180; player.pitch = (pitchDeg * Math.PI) / 180;
    if (lv !== undefined) player.lv = lv;
    player.inStair = false;
    updateFloor();
    player.y = player.feet;
    if (mode === 'top') { applyVisibility(); placeLabels(); }
  },
  setTop,
  setMode,
  setNight,
  orbit,
  // synchronous movement simulation (same code path as the game loop), for automated checks
  sim(x, z, yawDeg, f, r, seconds, lv) {
    window.__walk.setPlayer(x, z, yawDeg, 0, lv);
    joy.y = -f; joy.x = r;
    for (let i = 0; i < seconds * 60; i++) move(1 / 60);
    joy.x = joy.y = 0;
    return [+player.x.toFixed(2), +player.z.toFixed(2), player.lv, +player.feet.toFixed(2)];
  },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geoms: renderer.info.memory.geometries, tex: renderer.info.memory.textures }),
};
