// @ts-nocheck
/* Complète CAT_HULL_VERTS : pour chaque posture et un cycle de marche, ajoute les 60 sommets réellement les plus bas du maillage skinné.
   Usage : node --import tsx tools/extract-hull.mts > src/config/catHull.ts && node --import tsx tools/cat/augment-hull.mts */
import fs from 'node:fs';
import * as THREE from 'three';
import { makeRigSim } from '../../tests/helpers/rigSim';
import { CAT_HULL_VERTS } from '../../src/config/catHull';
const s = await makeRigSim(3);
let sm; s.root.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
const set = new Set(CAT_HULL_VERTS), v = new THREE.Vector3(), n = sm.geometry.attributes.position.count;
const sample = () => { s.root.updateMatrixWorld(true); sm.skeleton.update(); const ys = new Float32Array(n); for (let i = 0; i < n; i++) { sm.getVertexPosition(i, v); v.applyMatrix4(sm.matrixWorld); ys[i] = v.y; } Array.from(ys.keys()).sort((a, b) => ys[a] - ys[b]).slice(0, 60).forEach((i) => set.add(i)); };
const holds = ['sit', 'lie', 'sleep', 'stand'];
for (const g of holds) { s.posture.request(g); s.run(1 / 60, 20, () => s.posture.posture === g && !s.posture.busy, () => { if (Math.random() < 0.05) sample(); }); sample(); }
s.posture.groom(); s.run(1 / 60, 40, () => s.posture.lastDone?.name === 'Grooming' && !s.posture.busy, () => { if (Math.random() < 0.05) sample(); });
s.posture.stretch(); s.run(1 / 60, 10, () => s.posture.lastDone?.name === 'Stretching' && !s.posture.busy, () => { if (Math.random() < 0.05) sample(); });
for (let t = 0; t < 1; t += 0.05) { s.anim.mixer.setTime(t); s.anim.update(0.0001, { realSpeed: 0.3, omega: 0, pivoting: false }, { head: 0, spine: 0, pitch: 0 }); sample(); }
const out = [...set].sort((a, b) => a - b);
fs.writeFileSync('src/config/catHull.ts', `/** Généré par tools/extract-hull.mts puis tools/cat/augment-hull.mts : indices de sommets extrêmes du maillage skinné. */\nexport const CAT_HULL_VERTS: number[] = ${JSON.stringify(out)};\nexport const CAT_HULL: Record<string, number[][]> = {};\n`);
console.log('sommets du hull :', out.length);
