/* Points d'appui du maillage : sommets extrêmes (par os dominant, 100+ directions) servant à tenir le corps au-dessus du sol et à calculer les
   enveloppes par pose. Sortie : INDICES de sommets du maillage skinné ; le rig calcule leur position exacte avec le skinning complet
   (jusqu'à 4 os pondérés) : un hull « rigide » par os se trompait de plusieurs cm aux articulations.
   Usage : node --import tsx tools/extract-hull.mts > src/config/catHull.ts */
import * as THREE from 'three';
import { loadFox } from '../tests/helpers/loadFox';
const { root } = await loadFox();
root.updateMatrixWorld(true);
let sm: THREE.SkinnedMesh | null = null; root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) sm = o as THREE.SkinnedMesh; });
const mesh = sm as unknown as THREE.SkinnedMesh;
const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
const bones = mesh.skeleton.bones, inv = mesh.skeleton.boneInverses;
const per: Record<string, { i: number; p: THREE.Vector3 }[]> = {};
const v = new THREE.Vector3();
for (let i = 0; i < pos.count; i++) {
  let best = 0, bw = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
  v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix).applyMatrix4(inv[best]);
  (per[bones[best].name] ??= []).push({ i, p: v.clone() });
}
const fib = (n: number) => Array.from({ length: n }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5)); return [r * Math.cos(a), y, r * Math.sin(a)]; });
const dirs = [...fib(96), [0, -1, 0], [0, 1, 0]];
const keep = new Set<number>();
for (const pts of Object.values(per)) for (const d of dirs) { let b = pts[0], bv = -Infinity; for (const q of pts) { const s = q.p.x * d[0] + q.p.y * d[1] + q.p.z * d[2]; if (s > bv) { bv = s; b = q; } } keep.add(b.i); }
// sommets les plus bas en repère du modèle (talons, ventre, bassin) quel que soit l'os : utiles pour tous les états posés
const all = Array.from({ length: pos.count }, (_, i) => i).sort((a, b) => { const ya = v.fromBufferAttribute(pos, a).applyMatrix4(mesh.bindMatrix).y; const yb = new THREE.Vector3().fromBufferAttribute(pos, b).applyMatrix4(mesh.bindMatrix).y; return ya - yb; });
all.slice(0, 120).forEach((i) => keep.add(i));
console.log(`/** Généré par tools/extract-hull.mts : indices de sommets extrêmes du maillage skinné (voir ce fichier pour la méthode). */\nexport const CAT_HULL_VERTS: number[] = ${JSON.stringify([...keep].sort((a, b) => a - b))};\nexport const CAT_HULL: Record<string, number[][]> = {};`);
