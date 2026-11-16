// Loads the downloaded CC0 assets (public/assets, from polyhaven.com): photographic textures, HDRI skies and a few models.
// Everything is optional: if a file is missing the procedural materials stay in place.
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ROT = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };

export async function loadAssets({ renderer, scene, S, M, mobile, plans }) {
  let manifest;
  try {
    manifest = await (await fetch('assets/manifest.json')).json();
  } catch { return null; }

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();
  const cache = new Map();
  const T = manifest.textures;

  // a texture whose size is given in metres (the geometry UVs are in metres); mul stretches it, rot turns it
  const tex = (path, srgb, size, mul = 1, rot = 0) => {
    const k = `${path}|${mul}|${rot}`;
    if (cache.has(k)) return cache.get(k);
    const t = loader.load(path + (path.includes('interior_tiles') ? '?v=white' : ''));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(1 / (size[0] * mul), 1 / (size[1] * mul));
    if (rot) { t.center.set(0.5, 0.5); t.rotation = rot; }
    cache.set(k, t);
    return t;
  };
  const photo = (mat, key, { color = 0xffffff, mul = 1, rot = 0, ns = 0.8, rough = true } = {}) => {
    const t = T[key];
    if (!t || !mat) return;
    mat.map = tex(t.maps.diff, true, t.size_m, mul, rot);
    mat.color.set(color);
    if (!mobile) {
      mat.bumpMap = null;
      mat.normalMap = tex(t.maps.nor, false, t.size_m, mul, rot);
      if (mat.normalScale) mat.normalScale.set(ns, ns);
      if (rough) { mat.roughnessMap = tex(t.maps.rough, false, t.size_m, mul, rot); mat.roughness = 1; }
    }
    mat.needsUpdate = true;
  };
  // real plaster relief and gloss variation on the painted surfaces (colour stays exactly the palette's)
  const plaster = (mat) => {
    const t = T.plaster;
    if (!t || mobile) return;
    mat.bumpMap = null;
    mat.normalMap = tex(t.maps.nor, false, t.size_m, 1.4);
    mat.normalScale.set(0.7, 0.7);
    mat.roughnessMap = tex(t.maps.rough, false, t.size_m, 1.4);
    mat.roughness = 1;
    mat.needsUpdate = true;
  };

  // ---- surfaces
  photo(M.floor.tile, 'tile', { color: 0xffffff, mul: 1.8, rot: Math.PI / 4, ns: 0.25, rough: false });
  M.floor.tile.roughness = 0.06; // white glossy vitrified tile
  M.floor.tile.metalness = 0.05;
  M.floor.tile.envMapIntensity = 1.7;
  photo(M.floor.bath, 'bath', { color: 0xf2f2f2, mul: 1.0 });
  photo(M.wallTile, 'wallTile', { color: 0xffffff, mul: 1.0, ns: 0.5 });
  photo(M.floor.stone, 'stone', { color: 0xffffff, mul: 1.0 });
  photo(M.floor.balcony, 'balcony', { color: 0xf0e0d0, mul: 1.0 });
  photo(M.concrete, 'concrete', { color: 0xd4cec6, mul: 1.0 });
  photo(M.paving, 'concrete', { color: 0xbcb4ac, mul: 1.0 });
  photo(M.asphalt, 'asphalt', { color: 0x6f6f72, mul: 1.0 });
  photo(M.brick, 'brick', { color: 0xffffff, mul: 1.0, ns: 1.2 });
  photo(M.sand, 'ground', { color: 0xe6d6bc, mul: 1.0 });
  photo(M.wood, 'oak', { color: 0xffffff });
  photo(M.doorWood, 'oak', { color: 0xf4e4cc });
  photo(M.woodPanel, 'oak', { color: 0xe8c9a0 });
  photo(M.woodDark, 'walnut', { color: 0xffffff });
  photo(M.finWood, 'walnut', { color: 0xe0cbb6 });
  photo(M.louver, 'walnut', { color: 0xd0b497 });
  photo(M.woodSoft, 'teak', { color: 0xffffff });
  for (const m of [M.wall, M.ceiling, M.cream, M.taupe, M.bronze, M.white, M.slab, M.plasterGrey]) plaster(m);

  // ---- photographic skies (day dusk / night), lit and reflected like the real thing
  const hdrLoader = new HDRLoader();
  const pm = new THREE.PMREMGenerator(renderer);
  const sky = {};
  const target = S.sun.target.position;
  const desired = Math.atan2(0.78, -0.62); // the sun sits to the south-west, as in the elevation photo
  for (const key of ['day', 'night']) {
    const h = manifest.hdri[key];
    if (!h) continue;
    try {
      const t = await hdrLoader.loadAsync(h.file);
      t.mapping = THREE.EquirectangularReflectionMapping;
      const env = pm.fromEquirectangular(t).texture;
      const [sx, sy, sz] = h.sun;
      const psi = desired - Math.atan2(sz, sx) + Math.PI; // measured against the three.js equirect convention
      const cosT = Math.sqrt(Math.max(0, 1 - sy * sy));
      const dir = new THREE.Vector3(Math.cos(desired) * cosT, sy, Math.sin(desired) * cosT).normalize();
      sky[key] = { bg: t, env, psi, dir };
    } catch (e) { console.warn('HDRI failed', key, e); }
  }
  pm.dispose();

  const A = {
    ready: false,
    apply(night) {
      const s = sky[night ? 'night' : 'day'];
      if (!s) return false;
      scene.background = s.bg;
      scene.environment = s.env;
      scene.backgroundRotation.set(0, s.psi, 0);
      scene.environmentRotation.set(0, s.psi, 0);
      scene.backgroundIntensity = night ? 1.0 : 1.0;
      if (S.sky) S.sky.visible = false;
      // the key light comes from where the sun (or moon) really is in the photograph
      const d = night ? s.dir : s.dir.clone().setY(Math.max(0.2, s.dir.y));
      S.sun.position.copy(target).addScaledVector(d.clone().normalize(), 80);
      renderer.shadowMap.needsUpdate = true;
      return true;
    },
  };
  A.ready = !!sky.day;

  // ---- models
  const gltf = new GLTFLoader();
  const loadModel = async (id) => {
    try {
      const g = await gltf.loadAsync(manifest.models[id].file);
      g.scene.updateMatrixWorld(true);
      return g.scene;
    } catch (e) { console.warn('model failed', id, e); return null; }
  };
  const levelFor = (plan) => (plan === plans.first ? S.levels.first : S.levels.ground);

  const fan = await loadModel('ceiling_fan');
  if (fan) {
    const box = new THREE.Box3().setFromObject(fan);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const s = 1.2 / Math.max(size.x, size.z);
    const meshes = [];
    fan.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const plan of [plans.first, plans.ground]) {
      const spots = [];
      for (const r of plan.rooms) {
        if (r.name === 'Bedroom' || r.name === 'Drawing Room') { const q = r.rects[0]; spots.push([(q[0] + q[2]) / 2, (q[1] + q[3]) / 2 + (r.name === 'Drawing Room' ? 0.2 : 0)]); }
      }
      spots.push([6.7, 6.4]); // lounge
      const H = plan.ceilingHeight;
      for (const mesh of meshes) {
        const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, spots.length);
        spots.forEach(([x, z], i) => {
          const m = new THREE.Matrix4().makeTranslation(x - center.x * s, H - box.max.y * s, z - center.z * s)
            .multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(mesh.matrixWorld);
          inst.setMatrixAt(i, m);
        });
        inst.castShadow = true; inst.receiveShadow = true;
        levelFor(plan).group.add(inst);
      }
    }
  }

  // single pieces: a leather lounge chair in the drawing rooms, a small succulent on the tables
  const place = async (id, type, fit, yOffsetKey) => {
    const src = await loadModel(id);
    if (!src) return;
    const box = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const s = fit / Math.max(size.x, size.z);
    for (const plan of [plans.first, plans.ground]) {
      for (const it of plan.furniture) {
        if (it.type !== type) continue;
        const o = src.clone(true);
        o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        const wrap = new THREE.Group();
        o.position.set(-center.x, -box.min.y, -center.z);
        wrap.add(o);
        wrap.scale.setScalar(s);
        wrap.rotation.y = ROT[it.face || 'S'] + Math.PI; // the models face -z by default
        wrap.position.set(it.x, (it[yOffsetKey] ?? 0), it.y);
        levelFor(plan).group.add(wrap);
      }
    }
  };
  await place('mid_century_lounge_chair', 'loungechair', 0.82, 'hy');
  await place('potted_plant_04', 'succulent', 0.2, 'hy');
  renderer.shadowMap.needsUpdate = true;
  return A;
}
