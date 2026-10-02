// @ts-nocheck
/* Le clip Walk de Mesh2Motion est asymétrique (patte arrière droite : appui 50 % plus rapide que la gauche).
   Remplace les pistes de la patte arrière DROITE par celles de la GAUCHE, symétrisées (x, −y, −z, w) et décalées d'un demi-cycle.
   Usage : node --import tsx tools/cat/symmetrize-walk.mts [fichier.glb] */
import { NodeIO } from '@gltf-transform/core';
const file = process.argv[2] ?? 'assets/models/cat-rigged.glb';
const io = new NodeIO(); const doc = await io.read(file);
const walk = doc.getRoot().listAnimations().find((a) => a.getName() === 'Walk');
const BONES = ['Pelvis', 'Upper', 'Lower', 'Ankle', 'Foot', 'Foot_1', 'Tip'];
const chan = (side, b) => walk.listChannels().find((c) => c.getTargetNode().getName() === `Back_Leg_${b}_${side}` && c.getTargetPath() === 'rotation');
const slerp = (a, b, t) => { let d = a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]; const s = d < 0 ? -1 : 1; d *= s; const o = b.map((v) => v * s); if (d > 0.9995) { const r = a.map((v, i) => v + (o[i] - v) * t); const n = Math.hypot(...r); return r.map((v) => v / n); } const th = Math.acos(d), w1 = Math.sin((1 - t) * th) / Math.sin(th), w2 = Math.sin(t * th) / Math.sin(th); return a.map((v, i) => v * w1 + o[i] * w2); };
for (const b of BONES) {
  const L = chan('L', b), R = chan('R', b); if (!L || !R) continue;
  const times = L.getSampler().getInput().getArray(), lo = L.getSampler().getOutput().getArray(), n = times.length, dur = times[n - 1];
  const q = (i) => [lo[i*4], lo[i*4+1], lo[i*4+2], lo[i*4+3]];
  const at = (t) => { t = ((t % dur) + dur) % dur; let i = 0; while (i < n - 2 && times[i + 1] <= t) i++; const f = (t - times[i]) / (times[i + 1] - times[i] || 1); return slerp(q(i), q(i + 1), f); };
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const m = at(times[i] + dur / 2); out.set([m[0], -m[1], -m[2], m[3]], i * 4); }
  R.getSampler().setInput(L.getSampler().getInput()); R.getSampler().getOutput().setArray(out);
}
await io.write(file, doc); console.log('Walk symétrisé :', file);
