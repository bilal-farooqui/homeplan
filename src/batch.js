import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// UVs in world metres, so every texture keeps its real-world size on any piece (call after the geometry is placed)
export function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  if (!uv || !n) return g;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getZ(i)) > 0.5) uv.setXY(i, p.getX(i), p.getY(i));
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, p.getZ(i), p.getY(i));
    else uv.setXY(i, p.getX(i), p.getZ(i));
  }
  return g;
}

// Collects geometry per material and merges it, so the whole house is a few dozen draw calls.
export class Batch {
  constructor() { this.map = new Map(); }
  add(mat, geo) {
    if (geo.index) { const flat = geo.toNonIndexed(); geo.dispose(); geo = flat; } // rounded boxes are not indexed; merge needs them all alike
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(geo);
  }
  box(mat, x0, y0, z0, x1, y1, z1) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.add(mat, worldUV(g));
  }
  flush(group, { cast = true, receive = true } = {}) {
    for (const [mat, list] of this.map) {
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      list.forEach((g) => g.dispose());
    }
    this.map.clear();
  }
}

export function boxGeo(r) {
  const g = new THREE.BoxGeometry(r.x1 - r.x0, r.y1 - r.y0, r.z1 - r.z0);
  g.translate((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, (r.z0 + r.z1) / 2);
  return worldUV(g);
}
