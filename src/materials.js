import * as THREE from 'three';

function canvasTex(size, draw, aniso) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

const rnd = (() => {
  let s = 12345;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

// n x n tiles per texture, each tinted slightly differently, with grout lines.
function tiles(g, s, n, base, spread, grout, gw, speck) {
  const ts = s / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = (rnd() - 0.5) * spread;
      g.fillStyle = `rgb(${base[0] + k},${base[1] + k},${base[2] + k})`;
      g.fillRect(i * ts, j * ts, ts, ts);
      for (let q = 0; q < speck; q++) {
        g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 90},${rnd() > 0.5 ? 255 : 90},${rnd() > 0.5 ? 255 : 90},0.05)`;
        g.fillRect(i * ts + rnd() * ts, j * ts + rnd() * ts, 2 + rnd() * 3, 2 + rnd() * 3);
      }
      g.strokeStyle = 'rgba(120,110,100,0.10)';
      g.lineWidth = 2;
      g.beginPath();
      const x0 = i * ts + rnd() * ts, y0 = j * ts;
      g.moveTo(x0, y0);
      g.bezierCurveTo(x0 + 40, y0 + ts * 0.3, x0 - 40, y0 + ts * 0.7, x0 + 20, y0 + ts);
      g.stroke();
    }
  }
  g.strokeStyle = grout;
  g.lineWidth = gw;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, s); g.stroke();
    g.beginPath(); g.moveTo(0, i * ts); g.lineTo(s, i * ts); g.stroke();
  }
}

export function makeMaterials(renderer, mobile = false) {
  const an = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const L = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

  const tile = canvasTex(1024, (g, s) => tiles(g, s, 2, [246, 246, 244], 6, '#cfd0d0', 4, 300), an);
  const bathTile = canvasTex(512, (g, s) => tiles(g, s, 2, [118, 124, 128], 14, '#3d4144', 4, 300), an);
  const stone = canvasTex(512, (g, s) => {
    g.fillStyle = '#8f8a80'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1800; i++) {
      const v = 90 + rnd() * 90;
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 4 + rnd() * 8, 3 + rnd() * 6, rnd() * 3, 0, 7); g.fill();
    }
  }, an);
  const concrete = canvasTex(256, (g, s) => {
    g.fillStyle = '#9b9b97'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1500; i++) { const v = 130 + rnd() * 50; g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
  }, an);
  const terrace = canvasTex(512, (g, s) => tiles(g, s, 2, [150, 140, 128], 12, '#6b665e', 5, 200), an);
  const wood = canvasTex(256, (g, s) => {
    g.fillStyle = '#a9703f'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const v = rnd();
      g.strokeStyle = `rgba(${v > 0.5 ? '70,38,15' : '200,150,100'},${0.12 + rnd() * 0.15})`;
      g.lineWidth = 1 + rnd() * 2;
      const x = rnd() * s;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 10, s * 0.3, x - 10, s * 0.6, x + 4, s); g.stroke();
    }
  }, an);

  tile.repeat.set(1 / 1.6, 1 / 1.6);
  bathTile.repeat.set(1 / 0.6, 1 / 0.6);
  stone.repeat.set(1 / 1.2, 1 / 1.2);
  concrete.repeat.set(1 / 1.5, 1 / 1.5);
  terrace.repeat.set(1 / 1.0, 1 / 1.0);

  const M = {
    wall: L(0xf1ece2),
    wallTop: L(0xe2ddd2),
    ceiling: L(0xfbfaf7, { side: THREE.DoubleSide }),
    slab: L(0xddd3c1),
    floor: { tile: L(0xffffff, { map: tile }), bath: L(0xffffff, { map: bathTile }), stone: L(0xffffff, { map: stone }), concrete: L(0xffffff, { map: concrete }), balcony: L(0xffffff, { map: terrace }) },
    tileScale: { tile: 1.6, bath: 0.6, stone: 1.2, concrete: 1.5, balcony: 1.0 },
    doorWood: L(0xffffff, { map: wood }),
    alu: L(0x3a3d40),
    glass: new THREE.MeshStandardMaterial({ color: 0x8f897f, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.0, depthWrite: false }),
    glassPane: new THREE.MeshStandardMaterial({ color: 0xcfe8f2, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false }),
    lampDisc: new THREE.MeshBasicMaterial({ color: 0xfff1c9 }),
    column: L(0x4a4a4a),
    stair: L(0xc9c4ba),
    stairEdge: L(0x6f6a62),
    rail: L(0x555a5e),
    // furniture
    wood: L(0xffffff, { map: wood }),
    woodDark: L(0x5b3d2a),
    white: L(0xf2f1ee),
    cabinet: L(0xe9e3d6),
    cabinetEdge: L(0x9a9488),
    counterTop: L(0x2f3236),
    steel: new THREE.MeshStandardMaterial({ color: 0xbfc3c7, metalness: 0.7, roughness: 0.4 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x8c9094, metalness: 0.7, roughness: 0.45 }),
    black: L(0x17181a),
    screen: new THREE.MeshStandardMaterial({ color: 0x0b1018, roughness: 0.15, metalness: 0.3 }),
    ceramic: L(0xfafaf8),
    mirror: new THREE.MeshStandardMaterial({ color: 0xd8e8ef, metalness: 0.9, roughness: 0.08 }),
    fabric1: L(0x6d7b8a),
    fabric1b: L(0x7b8998),
    fabric2: L(0xcdbd9c),
    fabric2b: L(0xd8caad),
    blanket: L(0x86a398),
    green: L(0x3d7a3a),
    green2: L(0x56994a),
    pot: L(0xa8643a),
    soil: L(0x3a2b20),
    rugA: L(0xb9a98f),
    rugB: L(0x93a7b3),
    rugC: L(0xc6b7a2),
  };
  Object.assign(M, {
    cream: L(0xe0d3c2),
    taupe: L(0xa58f80),
    bronze: L(0x5a4638),
    white: L(0xf4f0ea),
    woodSoft: L(0xffffff, { map: wood }),
    sand: L(0xb89f84),
    hedge: L(0x93b13a),
    paving: L(0xa39a98),
    plasterGrey: L(0xbdb3a4),
    brick: L(0xffffff, { map: canvasTex(256, (g, s) => {
      g.fillStyle = '#8a4b3c'; g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < s; x += 32) {
        const v = 110 + rnd() * 40; g.fillStyle = `rgb(${v + 30},${v - 25},${v - 40})`; g.fillRect(x + 1, y + 1, 30, 14);
      }
    }, an) }),
    glowGlass: new THREE.MeshLambertMaterial({ color: 0x3a2c20, emissive: 0x9a6a38, emissiveIntensity: 0.7 }),
    slat: L(0xb39d89),
    cladLine: L(0xbfae9c),
    finWood: L(0x5d4636),
    louver: L(0x6a4f3d),
    niche: L(0x2a211b),
    concrete: L(0x9a948c),
    lampGlow: new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
  });
  M.brick.map.repeat.set(1 / 1.2, 1 / 1.2);
  M.woodSoft.color.set(0xf0b27a); // warm, orange-brown soffit like the elevation
  M.woodSoft.map = wood.clone();
  M.woodSoft.map.needsUpdate = true;
  // Doors/frames use the wood material.
  M.frameWood = M.doorWood;
  // ---- realism pass: glossy vitrified tile, reflective glass and metal, finer details
  const P = (o) => new THREE.MeshStandardMaterial(o);
  M.floor.tile = P({ map: tile, roughness: 0.28, metalness: 0.04 });
  M.floor.bath = P({ map: bathTile, roughness: 0.62 });
  M.floor.stone = P({ map: stone, roughness: 0.95 });
  M.floor.concrete = P({ map: concrete, roughness: 0.95 });
  M.floor.balcony = P({ map: terrace, roughness: 0.85 });
  M.glass = P({ color: 0x8f897f, transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0.1, depthWrite: false, envMapIntensity: 1.5 });
  M.glassPane = P({ color: 0xcfe8f2, transparent: true, opacity: 0.2, roughness: 0.04, depthWrite: false, envMapIntensity: 1.2 });
  M.doorWood = P({ map: wood, roughness: 0.5, metalness: 0 });
  M.frameWood = M.doorWood;
  M.alu = P({ color: 0x3a3d40, roughness: 0.45, metalness: 0.6 });
  M.rail = P({ color: 0x555a5e, roughness: 0.4, metalness: 0.7 });

  const wallTileTex = canvasTex(512, (g, s) => tiles(g, s, 2, [236, 239, 240], 8, '#b4babd', 3, 160), an);
  wallTileTex.repeat.set(1 / 0.6, 1 / 0.6);
  const aoTex = canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, s * 0.12, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(0,0,0,0.5)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  }, 1);
  aoTex.wrapS = aoTex.wrapT = THREE.ClampToEdgeWrapping;
  Object.assign(M, {
    skirt: L(0xf4f0e8),
    wallTile: P({ map: wallTileTex, roughness: 0.25, metalness: 0 }),
    aoBlob: new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    curtain: L(0xe6dfd1, { side: THREE.DoubleSide }),
    curtainB: L(0xc9d0d3, { side: THREE.DoubleSide }),
    sillBoard: L(0xf2eee6),
    artFrame: L(0x2b2420),
    artA: L(0x3d7f86), artB: L(0xd09a4a), artC: L(0xb9604a), artD: L(0x6f7f9a),
    asphalt: L(0x3a3a3d),
    kerb: L(0xb9b4ab),
    roadLine: L(0xe8e4d8),
    trunk: L(0x6b4a32),
    leafA: L(0x4f7d3a), leafB: L(0x659545),
    carPaint: P({ color: 0xcdd0d4, roughness: 0.32, metalness: 0.55 }),
    carGlass: P({ color: 0x1b232b, roughness: 0.05, metalness: 0.2 }),
    rubber: L(0x151515),
    headlight: new THREE.MeshBasicMaterial({ color: 0xfff3d0 }),
    tailLight: new THREE.MeshBasicMaterial({ color: 0xb01818 }),
    pole: L(0x4a4a4c),
  });
  // ======== realism pass 2: real-scale plaster, grain, weave and leaf textures ========
  // Phones get Lambert versions (same textures and bump, no reflections) to stay smooth.
  const mat = (o) => {
    if (!mobile) return new THREE.MeshStandardMaterial(o);
    const { roughness, metalness, envMapIntensity, ...rest } = o;
    return new THREE.MeshLambertMaterial(rest);
  };
  const noise = (size, scales, amp) => canvasTex(size, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (const sc of scales) {
      const n = Math.max(2, Math.round(s / sc));
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const v = 128 + (rnd() - 0.5) * amp * (sc / scales[0]);
        g.fillStyle = `rgba(${v},${v},${v},0.5)`;
        g.fillRect((i * s) / n, (j * s) / n, s / n + 1, s / n + 1);
      }
    }
  }, an);
  const plasterBump = noise(256, [64, 16, 4, 2], 70);
  plasterBump.repeat.set(1 / 1.4, 1 / 1.4);
  const grainCanvas = (bump) => canvasTex(512, (g, s) => {
    g.fillStyle = bump ? '#909090' : '#a9703f'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) {
      const x = rnd() * s, w = 0.6 + rnd() * 2.6, v = rnd();
      g.strokeStyle = bump ? `rgba(${v > 0.5 ? 40 : 200},${v > 0.5 ? 40 : 200},${v > 0.5 ? 40 : 200},${0.15 + rnd() * 0.3})`
        : `rgba(${v > 0.55 ? '74,40,16' : '214,160,104'},${0.1 + rnd() * 0.22})`;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (rnd() - 0.5) * 24, s * 0.3, x + (rnd() - 0.5) * 24, s * 0.65, x + (rnd() - 0.5) * 8, s); g.stroke();
    }
    for (let k = 0; k < 4; k++) { // knots
      const x = rnd() * s, y = rnd() * s;
      g.strokeStyle = bump ? 'rgba(30,30,30,0.4)' : 'rgba(70,36,14,0.35)'; g.lineWidth = 1.5;
      for (let r = 3; r < 14; r += 3) { g.beginPath(); g.ellipse(x, y, r * 0.7, r * 1.6, 0, 0, 7); g.stroke(); }
    }
  }, an);
  const woodMap = grainCanvas(false), woodBump = grainCanvas(true);
  woodMap.repeat.set(1 / 0.9, 1 / 0.9); woodBump.repeat.set(1 / 0.9, 1 / 0.9);
  const weave = canvasTex(64, (g, s) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 4) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(i, 0, 2, s); g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, i, s, 2); }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.07})`; g.fillRect(rnd() * s, rnd() * s, 1, 1); }
  }, an);
  weave.repeat.set(14, 14);
  const fibre = canvasTex(128, (g, s) => {
    g.fillStyle = '#efefef'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { const v = 150 + rnd() * 105; g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2, 1); }
  }, an);
  fibre.repeat.set(5, 5);
  const speck = noise(256, [32, 8, 2], 90);
  speck.repeat.set(1 / 2, 1 / 2);

  M.floor.tile = mobile
    ? new THREE.MeshPhongMaterial({ map: tile, specular: 0x8a8a8a, shininess: 110 }) // glossy highlights without the cost of reflections
    : mat({ map: tile, roughness: 0.06, metalness: 0.05, envMapIntensity: 1.7 });
  M.floor.bath = mat({ map: bathTile, roughness: 0.62 });
  M.floor.stone = mat({ map: stone, roughness: 0.95 });
  M.floor.concrete = mat({ map: concrete, roughness: 0.95 });
  M.floor.balcony = mat({ map: terrace, roughness: 0.85 });
  M.glass = mat({ color: 0x8f897f, transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0.1, depthWrite: false, envMapIntensity: 1.5 });
  M.glassPane = mat({ color: 0xcfe8f2, transparent: true, opacity: 0.2, roughness: 0.04, depthWrite: false, envMapIntensity: 1.2 });
  M.alu = mat({ color: 0x3a3d40, roughness: 0.45, metalness: 0.6 });
  M.rail = mat({ color: 0x555a5e, roughness: 0.4, metalness: 0.7 });
  M.wallTile = mat({ map: M.wallTile.map, roughness: 0.25, metalness: 0 });
  const paint = (color, extra = {}) => mat({ color, bumpMap: plasterBump, bumpScale: 0.9, roughness: 0.92, metalness: 0, ...extra });
  M.wall = paint(0xf1ece2);
  M.ceiling = paint(0xfbfaf7, { side: THREE.DoubleSide, bumpScale: 0.5 });
  M.cream = paint(0xe0d3c2); M.taupe = paint(0x9b8575, { roughness: 0.85 }); M.white = paint(0xf4f0ea, { roughness: 0.8 });
  M.bronze = paint(0x46372c, { roughness: 0.6, bumpScale: 0.5 });
  M.slab = paint(0xddd3c1);
  M.plasterGrey = paint(0xbdb3a4); M.concrete = mat({ color: 0x9a948c, bumpMap: speck, bumpScale: 1.2, roughness: 0.95 });
  M.skirt = mat({ color: 0xf4f0e8, roughness: 0.6 });
  M.cove = new THREE.MeshBasicMaterial({ color: 0xffe0b0 });
  const marbleTex = canvasTex(512, (g, s) => {
    g.fillStyle = '#f6f4f0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) { // soft grey veins
      let x = rnd() * s, y = rnd() * s;
      g.strokeStyle = `rgba(120,125,135,${0.12 + rnd() * 0.22})`; g.lineWidth = 0.6 + rnd() * 2.2;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (rnd() - 0.35) * 90; y += (rnd() - 0.5) * 90; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 700; i++) { const v = 225 + rnd() * 30; g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
  }, an);
  marbleTex.repeat.set(1 / 1.2, 1 / 1.2);
  M.marble = mat({ color: 0xffffff, map: marbleTex, roughness: 0.12, metalness: 0.04, envMapIntensity: 1.3 });

  const fab = (color) => mat({ color, map: weave, bumpMap: weave, bumpScale: 0.6, roughness: 0.97 });
  M.fabric1 = fab(0x6d7b8a); M.fabric1b = fab(0x7b8998); M.fabric2 = fab(0xcdbd9c); M.fabric2b = fab(0xd8caad);
  M.blanket = fab(0x86a398); M.accent = fab(0x4f8c8a); M.curtain = fab(0xe6dfd1); M.curtain.side = THREE.DoubleSide;
  M.curtainB = fab(0xc9d0d3); M.curtainB.side = THREE.DoubleSide;
  M.rugA = mat({ color: 0xb9a98f, map: fibre, bumpMap: fibre, bumpScale: 0.8, roughness: 1 });
  M.rugB = mat({ color: 0x93a7b3, map: fibre, bumpMap: fibre, bumpScale: 0.8, roughness: 1 });
  M.rugC = mat({ color: 0xc6b7a2, map: fibre, bumpMap: fibre, bumpScale: 0.8, roughness: 1 });
  M.rugBorder = mat({ color: 0x6d5f50, map: fibre, roughness: 1 });
  M.lampShade = mat({ color: 0xf3ead8, roughness: 0.9, side: THREE.DoubleSide });

  const wd = (color = 0xffffff, rough = 0.55) => mat({ color, map: woodMap, bumpMap: woodBump, bumpScale: 0.35, roughness: rough, metalness: 0 });
  M.wood = wd(); M.doorWood = wd(0xffffff, 0.5); M.frameWood = M.doorWood; M.woodSoft = wd(0xf0b27a, 0.5);
  M.woodDark = wd(0x7a5a46, 0.6); M.finWood = wd(0x7d5f4c, 0.6); M.louver = wd(0x8a6a55, 0.6);
  M.woodPanel = wd(0xffe2c0, 0.5); M.doorPanel = wd(0xd9b78a, 0.5);
  M.cabinet = mat({ color: 0xe9e3d6, roughness: 0.5 }); M.cabinetDoor = mat({ color: 0xf0eadd, roughness: 0.4 });
  M.glassTop = mat({ color: 0xbfd7dc, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, depthWrite: false });
  M.stem = mat({ color: 0x4a6a30, roughness: 0.9 });

  // leaf cards: a painted leaf shape with veins, cut out by alpha
  const leafTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, '#2f6a2a'); gr.addColorStop(1, '#5c9a3e');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(32, 126); g.quadraticCurveTo(-4, 70, 32, 2); g.quadraticCurveTo(68, 70, 32, 126); g.fill();
    g.strokeStyle = 'rgba(210,235,170,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(32, 122); g.lineTo(32, 10); g.stroke();
    g.lineWidth = 1;
    for (let y = 100; y > 24; y -= 16) { g.beginPath(); g.moveTo(32, y); g.lineTo(12, y - 14); g.moveTo(32, y); g.lineTo(52, y - 14); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })();
  M.leafCard = new THREE.MeshLambertMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide });
  M.leafCard2 = new THREE.MeshLambertMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xd6ec9c });
  M.hedgeDark = new THREE.MeshLambertMaterial({ color: 0x3f6a2a });

  M.asphalt = mat({ color: 0x3a3a3d, map: speck, bumpMap: speck, bumpScale: 1.5, roughness: 0.95 });
  M.paving = mat({ color: 0xa39a98, map: speck, bumpMap: speck, bumpScale: 0.8, roughness: 0.9 });
  M.sand = mat({ color: 0xb89f84, map: speck, bumpMap: speck, bumpScale: 1.0, roughness: 1 });
  M.brick.bumpMap = M.brick.map; M.brick.bumpScale = 1.2;
  return M;
}
