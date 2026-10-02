// @ts-nocheck
/* Point d'appui sous chaque patte : sommet de patte le plus bas en pose de liage, exprimé dans le repère de l'os du bout de patte (unités du modèle).
   Usage : node --import tsx tools/cat/soles.mts */
import * as THREE from 'three';
import { loadFox } from '../../tests/helpers/loadFox';
const { root } = await loadFox(); root.updateMatrixWorld(true);
let sm; root.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
const sk = sm.skeleton, g = sm.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
const idx = (n) => sk.bones.findIndex((b) => b.name === n);
const out = {};
for (const side of ['L', 'R']) for (const leg of ['Front', 'Back']) {
  const set = leg === 'Front' ? [`Front_Leg_Tip_${side}`, `Front_Leg_Foot_${side}`] : [`Back_Leg_Tip_${side}`, `Back_Leg_Foot_1_${side}`, `Back_Leg_Foot_${side}`];
  const ids = set.map(idx); let best = null, by = Infinity; const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (ids.includes(si.getComponent(i, k))) w += sw.getComponent(i, k); if (w < 0.5) continue; v.fromBufferAttribute(pos, i).applyMatrix4(sm.bindMatrix); if (v.y < by) { by = v.y; best = i; } }
  // moyenne des 12 sommets les plus bas (stabilité) en repère de l'os du bout
  const tipI = idx(`${leg}_Leg_Tip_${side}`); const cand = [];
  for (let i = 0; i < pos.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (ids.includes(si.getComponent(i, k))) w += sw.getComponent(i, k); if (w < 0.5) continue; v.fromBufferAttribute(pos, i).applyMatrix4(sm.bindMatrix); cand.push({ y: v.y, p: v.clone() }); }
  cand.sort((a, b) => a.y - b.y); const low = cand.slice(0, 12); const c = low.reduce((a, q) => a.add(q.p), new THREE.Vector3()).divideScalar(low.length);
  const local = c.clone().applyMatrix4(sk.boneInverses[tipI]);
  const tipWorld = sk.boneInverses[tipI].clone().invert(); const tp = new THREE.Vector3().setFromMatrixPosition(tipWorld);
  console.log(`${leg}_Leg_Tip_${side}`, 'sol (bind) y', c.y.toFixed(4), 'os y', tp.y.toFixed(4), 'offset local', local.toArray().map((x) => +x.toFixed(4)));
  out[`${leg}_Leg_Tip_${side}`] = local.toArray().map((x) => +x.toFixed(4));
}
console.log(JSON.stringify(out));
