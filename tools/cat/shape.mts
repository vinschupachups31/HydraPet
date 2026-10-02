// @ts-nocheck
/* Forme du corps pendant un scénario : détecte les replis (hauteur du bassin, extension des pattes arrière, longueurs de segments).
   Usage : node --import tsx tools/cat/shape.mts <scénario> [ik=1|0] */
import * as THREE from 'three';
import { runDiag } from '../../tests/helpers/diagSim';
const id = process.argv[2] ?? 'uturn', ik = process.argv[3] !== '0';
const P = (root, n) => root.getObjectByName(n).getWorldPosition(new THREE.Vector3());
const seg = [['Back_Leg_Upper_R', 'Back_Leg_Lower_R'], ['Back_Leg_Lower_R', 'Back_Leg_Ankle_R'], ['Back_Leg_Upper_L', 'Back_Leg_Lower_L'], ['Front_Leg_Upper_L', 'Front_Leg_Lower_L']];
let rest = null; const rows = [];
await runDiag(id, { ik, fps: 60, onFrame: ({ t, root, group, anim, measuring }) => {
  root.updateMatrixWorld(true);
  const sc = root.scale.x;
  const L = seg.map(([a, b]) => P(root, a).distanceTo(P(root, b)) / sc);
  const hipY = P(root, 'Hips').y, h = P(root, 'Head').y;
  const ext = ['L', 'R'].map((s) => P(root, `Back_Leg_Upper_${s}`).distanceTo(P(root, `Back_Leg_Tip_${s}`)) / sc);
  const spine = P(root, 'Hips').distanceTo(P(root, 'Spine_3')) / sc;
  rest ??= { L, ext, spine };
  rows.push({ t, hipY: hipY / sc, head: h / sc, ext, L, spine, w: anim.debug().walkW, low: anim.rig.lowestY() });
} });
const mx = (f) => Math.max(...rows.map(f)), mn = (f) => Math.min(...rows.map(f));
console.log(`${id} ik=${ik} : ${rows.length} images`);
console.log('hauteur bassin (u) min/max', mn((r) => r.hipY).toFixed(3), mx((r) => r.hipY).toFixed(3));
console.log('extension patte arrière G min/max', mn((r) => r.ext[0]).toFixed(3), mx((r) => r.ext[0]).toFixed(3), '| D', mn((r) => r.ext[1]).toFixed(3), mx((r) => r.ext[1]).toFixed(3), '| repos', rest.ext.map((v) => v.toFixed(3)).join(' / '));
console.log('longueur segments min/max vs repos', rest.L.map((l, i) => `${mn((r) => r.L[i]).toFixed(3)}..${mx((r) => r.L[i]).toFixed(3)} (${l.toFixed(3)})`).join('  '));
console.log('bassin→garrot min/max', mn((r) => r.spine).toFixed(3), mx((r) => r.spine).toFixed(3), 'repos', rest.spine.toFixed(3));
console.log('point le plus bas du maillage min/max (m)', mn((r) => r.low).toFixed(3), mx((r) => r.low).toFixed(3));
const worst = rows.reduce((a, r) => (r.hipY < a.hipY ? r : a)); console.log('bassin le plus bas à t=', worst.t.toFixed(2), worst.hipY.toFixed(3));
