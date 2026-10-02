/* Inventaire du modèle : maillages, morph targets, hiérarchie d'os, clips (durée, os animés, poses début/fin).
   Usage : node tools/inventory.mjs assets/models/fox.glb */
import { NodeIO } from '@gltf-transform/core';
const doc = await new NodeIO().read(process.argv[2] ?? 'assets/models/fox.glb');
const root = doc.getRoot();
console.log('Asset :', JSON.stringify(root.getAsset().generator ?? ''), '| scènes', root.listScenes().length);
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) console.log(`maillage ${m.getName()} : ${p.getAttribute('POSITION').getCount()} sommets, morph targets : ${p.listTargets().length}`);
for (const sk of root.listSkins()) console.log(`peau ${sk.getName()} : ${sk.listJoints().length} os`);
const joints = new Set(root.listSkins().flatMap((s) => s.listJoints()));
const print = (n, d) => { console.log(' '.repeat(d * 2) + n.getName() + (joints.has(n) ? '' : ' (non-os)') + '  t=' + n.getTranslation().map((v) => v.toFixed(1)).join(',')); for (const c of n.listChildren()) print(c, d + 1); };
console.log('--- hiérarchie'); for (const s of root.listScenes()) for (const n of s.listChildren()) print(n, 0);
console.log('--- clips');
for (const a of root.listAnimations()) {
  let dur = 0; const bones = new Set(); const paths = {};
  for (const c of a.listChannels()) { const t = c.getSampler().getInput().getArray(); dur = Math.max(dur, t[t.length - 1]); bones.add(c.getTargetNode().getName()); paths[c.getTargetPath()] = (paths[c.getTargetPath()] ?? 0) + 1; }
  let loopErr = 0; for (const c of a.listChannels()) { const o = c.getSampler().getOutput(), k = c.getTargetPath() === 'rotation' ? 4 : 3, arr = o.getArray(), n = arr.length / k; for (let j = 0; j < k; j++) loopErr = Math.max(loopErr, Math.abs(arr[j] - arr[(n - 1) * k + j])); }
  console.log(`${a.getName()} : ${dur.toFixed(3)} s, ${bones.size} os animés, canaux ${JSON.stringify(paths)}, écart pose début/fin ${loopErr.toFixed(3)} (${loopErr < 0.02 ? 'bouclé' : 'non bouclé'})`);
}
