/* Analyse géométrique du chat statique : silhouette de profil (x avant, y haut), repères pour caler le squelette. */
import { NodeIO } from '@gltf-transform/core';
const doc = await new NodeIO().read('assets/models/cat-source.glb');
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION').getArray();
const n = P.length / 3;
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i * 3 + k]); mx[k] = Math.max(mx[k], P[i * 3 + k]); }
console.log('bbox', mn.map((v) => v.toFixed(3)), mx.map((v) => v.toFixed(3)), 'sommets', n);
// silhouette ASCII (x en colonnes, y en lignes)
const W = 110, H = 38; const grid = Array.from({ length: H }, () => Array(W).fill(' '));
for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1]; const c = Math.floor(((x - mn[0]) / (mx[0] - mn[0])) * (W - 1)), r = H - 1 - Math.floor(((y - mn[1]) / (mx[1] - mn[1])) * (H - 1)); grid[r][c] = '#'; }
console.log(grid.map((r) => r.join('')).join('\n'));
// pour chaque tranche en x : y min / max / largeur z
console.log('x        ymin    ymax    zwidth');
for (let s = 0; s < 20; s++) { const x0 = mn[0] + (s / 20) * (mx[0] - mn[0]), x1 = mn[0] + ((s + 1) / 20) * (mx[0] - mn[0]); let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < n; i++) { const x = P[i * 3]; if (x < x0 || x >= x1) continue; y0 = Math.min(y0, P[i * 3 + 1]); y1 = Math.max(y1, P[i * 3 + 1]); z0 = Math.min(z0, P[i * 3 + 2]); z1 = Math.max(z1, P[i * 3 + 2]); } console.log(((x0 + x1) / 2).toFixed(3).padStart(7), y0.toFixed(3).padStart(7), y1.toFixed(3).padStart(7), (z1 - z0).toFixed(3).padStart(7)); }
