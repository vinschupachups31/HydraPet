// @ts-nocheck
/* Contact réel avec le sol : point le plus bas du maillage SKINNÉ (tous les sommets) comparé à celui du hull utilisé par la correction du sol.
   Usage : node --import tsx tools/cat/groundcheck.mts */
import * as THREE from 'three';
import { makeRigSim } from '../../tests/helpers/rigSim';
const s = await makeRigSim(3);
let sm; s.root.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
const v = new THREE.Vector3();
const trueLowest = () => { s.root.updateMatrixWorld(true); sm.skeleton.update(); let m = Infinity, at = null; const n = sm.geometry.attributes.position.count; for (let i = 0; i < n; i++) { sm.getVertexPosition(i, v); v.applyMatrix4(sm.matrixWorld); if (v.y < m) { m = v.y; at = v.clone(); } } return { m, at }; };
const report = (name) => { const t = trueLowest(); console.log(name.padEnd(10), 'hull', (s.lowest() * 100).toFixed(2).padStart(7), 'cm | maillage réel', (t.m * 100).toFixed(2).padStart(7), 'cm | écart', ((t.m - s.lowest()) * 100).toFixed(2).padStart(6), 'cm', 'au point', t.at.toArray().map((x) => (x * 100).toFixed(0)).join(',')); };
s.step(1 / 60); report('debout');
for (const g of ['sit', 'lie', 'sleep', 'stand']) { s.posture.request(g); s.run(1 / 60, 20, () => s.posture.posture === g && !s.posture.busy); for (let i = 0; i < 30; i++) s.step(1 / 60); report(g); }
s.posture.stretch(); let worst = 0; s.run(1 / 60, 10, () => s.posture.lastDone?.name === 'Stretching' && !s.posture.busy, () => { const t = trueLowest(); worst = Math.min(worst, t.m); }); console.log('étirement  plus bas réel', (worst * 100).toFixed(2), 'cm');
