/* Repères du chat en espace scène (x avant, y haut, z latéral ; gauche = -z) : tête, oreilles, nez, menton, pattes, queue. */
import * as THREE from 'three';
import { loadFox } from '../../tests/helpers/loadFox';
const { root } = await loadFox('assets/models/cat-source.glb'); root.updateMatrixWorld(true);
const pts: THREE.Vector3[] = [];
root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld)); });
const f = (v: number) => v.toFixed(3);
const centroid = (a: THREE.Vector3[]) => { const c = new THREE.Vector3(); a.forEach((p) => c.add(p)); return c.multiplyScalar(1 / Math.max(1, a.length)); };
const box = (a: THREE.Vector3[]) => new THREE.Box3().setFromPoints(a);
// tête : x > 0.37 et y > 0.0
const head = pts.filter((p) => p.x > 0.37 && p.y > -0.02);
const hb = box(head); console.log('tête x', f(hb.min.x), f(hb.max.x), 'y', f(hb.min.y), f(hb.max.y), 'z', f(hb.min.z), f(hb.max.z), 'centre', centroid(head).toArray().map(f).join(','));
const nose = head.reduce((a, b) => (b.x > a.x ? b : a)); console.log('nez (x max)', nose.toArray().map(f).join(','));
const earPts = head.filter((p) => p.y > hb.max.y - 0.07); const eL = earPts.filter((p) => p.z < 0), eR = earPts.filter((p) => p.z > 0);
console.log('oreille z<0 (gauche)', centroid(eL).toArray().map(f).join(','), 'haut', f(Math.max(...eL.map((p) => p.y))), 'n', eL.length, '| z>0', centroid(eR).toArray().map(f).join(','), 'n', eR.length);
const chin = head.filter((p) => p.x > 0.42).reduce((a, b) => (b.y < a.y ? b : a)); console.log('menton (y min, x>0.42)', chin.toArray().map(f).join(','));
// cou : coupes x entre 0.28 et 0.40
for (let x = 0.26; x <= 0.42; x += 0.02) { const s = pts.filter((p) => Math.abs(p.x - x) < 0.01 && p.y > -0.05); if (s.length) { const b = box(s); console.log('x', f(x), 'y', f(b.min.y), f(b.max.y), 'z', f(b.min.z), f(b.max.z)); } }
// pattes : tranches y < -0.25 (bas des pattes) groupées par x
const low = pts.filter((p) => p.y < -0.3);
const groups: THREE.Vector3[][] = [[], [], [], []];
for (const p of low) { const gx = p.x > 0.1 ? 0 : 2; const gz = p.z < 0 ? 0 : 1; groups[gx + gz].push(p); }
['avant gauche(z<0)', 'avant droite', 'arrière gauche', 'arrière droite'].forEach((n, i) => console.log('patte', n, 'centre', centroid(groups[i]).toArray().map(f).join(','), 'n', groups[i].length));
// hauteur des articulations : centroïde de la patte à différentes hauteurs
for (const [name, xr, zs] of [['avant gauche', [0.2, 0.45], -1], ['arrière gauche', [-0.3, -0.05], -1]] as const) { for (const y of [-0.3, -0.2, -0.1, 0.0, 0.1, 0.2]) { const s = pts.filter((p) => p.x > xr[0] && p.x < xr[1] && Math.abs(p.y - y) < 0.02 && p.z * zs > 0.01); if (s.length) { const b = box(s); console.log(name, 'y', f(y), 'x', f(b.min.x), f(b.max.x), 'z', f(b.min.z), f(b.max.z), 'c', centroid(s).toArray().map(f).join(',')); } } }
// queue : x < -0.33 : centre par tranche de x
for (let x = -0.5; x <= -0.33; x += 0.02) { const s = pts.filter((p) => Math.abs(p.x - x) < 0.01 && p.y > -0.02); if (s.length) console.log('queue x', f(x), 'centre', centroid(s).toArray().map(f).join(','), 'y', f(box(s).min.y), f(box(s).max.y)); }
// croupe / dos
for (let x = -0.3; x <= 0.3; x += 0.1) { const s = pts.filter((p) => Math.abs(p.x - x) < 0.02); const b = box(s); console.log('corps x', f(x), 'dos y', f(b.max.y), 'ventre y>-0.3', f(Math.min(...s.filter((p) => p.y > -0.3).map((p) => p.y))), 'z larg', f(b.max.z - b.min.z)); }
