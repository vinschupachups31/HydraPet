/* Points d'appui du maillage : pour chaque os, quelques sommets extrêmes (dans le repère de l'os) —
   servent à garder le corps au-dessus du sol et à tester les contacts patte/museau sans calculer tout le maillage.
   Usage : node --import tsx tools/extract-hull.mts > src/config/catHull.ts */
import * as THREE from 'three';
import { loadFox } from '../tests/helpers/loadFox';
const { root } = await loadFox();
root.updateMatrixWorld(true);
let sm: THREE.SkinnedMesh | null = null; root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) sm = o as THREE.SkinnedMesh; });
const mesh = sm as unknown as THREE.SkinnedMesh; mesh.skeleton.calculateInverses?.();
const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
const bones = mesh.skeleton.bones, inv = mesh.skeleton.boneInverses;
const per: Record<string, THREE.Vector3[]> = {};
const v = new THREE.Vector3();
for (let i = 0; i < pos.count; i++) {
  let best = 0, bw = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
  v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix).applyMatrix4(inv[best]); // repère local de l'os (pose de liage)
  (per[bones[best].name] ??= []).push(v.clone());
}
const dirs: number[][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], ...[1, -1].flatMap((a) => [1, -1].flatMap((b) => [1, -1].map((c) => [a, b, c])))];
const out: Record<string, number[][]> = {};
for (const [name, pts] of Object.entries(per)) {
  const keep = new Map<string, THREE.Vector3>();
  for (const d of dirs) { let b = pts[0], bv = -Infinity; for (const p of pts) { const s = p.x * d[0] + p.y * d[1] + p.z * d[2]; if (s > bv) { bv = s; b = p; } } keep.set(`${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)}`, b); }
  out[name] = [...keep.values()].map((p) => [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]);
}
console.log(`/** Généré par tools/extract-hull.mts : sommets extrêmes du maillage par os (repère local de l'os, unités du modèle). */\nexport const CAT_HULL: Record<string, number[][]> = ${JSON.stringify(out)};`);
