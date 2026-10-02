/* Analyse du chat statique en espace scène (nœuds appliqués) : silhouette de profil et de dessus, repères pour caler le squelette.
   Usage : node --import tsx tools/cat/analyze.mts */
import * as THREE from 'three';
import { loadFox } from '../../tests/helpers/loadFox';
const { root } = await loadFox('assets/models/cat-source.glb');
root.updateMatrixWorld(true);
const pts: THREE.Vector3[] = [];
root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld)); });
const box = new THREE.Box3().setFromPoints(pts);
console.log('bbox', box.min.toArray().map((v) => v.toFixed(3)), box.max.toArray().map((v) => v.toFixed(3)), 'sommets', pts.length);
const ascii = (ax: 0 | 1 | 2, ay: 0 | 1 | 2, W = 110, H = 34) => { const g = Array.from({ length: H }, () => Array(W).fill(' ')); const a = [box.min.x, box.min.y, box.min.z], b = [box.max.x, box.max.y, box.max.z]; for (const p of pts) { const v = [p.x, p.y, p.z]; const c = Math.floor(((v[ax] - a[ax]) / (b[ax] - a[ax])) * (W - 1)), r = H - 1 - Math.floor(((v[ay] - a[ay]) / (b[ay] - a[ay])) * (H - 1)); g[r][c] = '#'; } return g.map((r) => r.join('')).join('\n'); };
console.log('PROFIL (x → avant, y haut)\n' + ascii(0, 1));
console.log('x       ymin    ymax   zlarg');
for (let s = 0; s < 25; s++) { const x0 = box.min.x + (s / 25) * (box.max.x - box.min.x), x1 = box.min.x + ((s + 1) / 25) * (box.max.x - box.min.x); let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { if (p.x < x0 || p.x >= x1) continue; y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); } console.log(((x0 + x1) / 2).toFixed(3).padStart(7), y0.toFixed(3).padStart(7), y1.toFixed(3).padStart(7), (z1 - z0).toFixed(3).padStart(7)); }
