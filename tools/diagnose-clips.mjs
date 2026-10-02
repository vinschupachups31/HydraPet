/* Diagnostic des animations de locomotion : translation racine, type d'allure, phases d'appui.
   Usage : node tools/diagnose-clips.mjs assets/models/fox.glb [clipMarche] [clipCourse] */
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const [file, ...clipNames] = process.argv.slice(2);
const io = new NodeIO();
const doc = await io.read(file);
const root = doc.getRoot();

console.log('=== 1. Translation racine dans les clips ===');
for (const anim of root.listAnimations()) {
  const rows = [];
  for (const ch of anim.listChannels()) {
    if (ch.getTargetPath() !== 'translation') continue;
    const s = ch.getSampler(); const v = s.getOutput().getArray(); const n = v.length / 3;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[i * 3 + k]); mx[k] = Math.max(mx[k], v[i * 3 + k]); }
    rows.push(`${ch.getTargetNode().getName()} : amplitude xyz = ${[0, 1, 2].map((k) => (mx[k] - mn[k]).toFixed(2)).join(' / ')}`);
  }
  console.log(`${anim.getName().padEnd(8)} ${rows.length ? 'canaux de translation → ' + rows.join(' | ') : 'AUCUN canal de translation (clip entièrement in-place par os)'}`);
}

// translation du premier os racine du squelette (hanche) dans le temps : dérive vers l'avant ?
const bin = await (async () => { root.listMaterials().forEach((m) => m.setBaseColorTexture(null)); root.listTextures().forEach((t) => t.dispose()); return io.writeBinary(doc); })();
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '', res, rej));
const scene = gltf.scene; scene.updateMatrixWorld(true);
const bones = []; scene.traverse((o) => { if (o.isBone) bones.push(o); });
const by = (re) => bones.find((b) => re.test(b.name));
const hip = by(/hip|pelvis/i), head = by(/head/i);
const feet = bones.filter((b) => /(hand|foot02)/i.test(b.name) && !bones.some((c) => c.parent === b && /(hand|foot02)/i.test(c.name)));
const wp = (b) => b.getWorldPosition(new THREE.Vector3());
const fwd = wp(head).sub(wp(hip)); fwd.y = 0; fwd.normalize();
const mixer = new THREE.AnimationMixer(scene);
const names = clipNames.length ? clipNames : ['Walk', 'Run'];
console.log('\n=== 2. Dérive de la hanche (translation racine effective) et type d\'allure ===');
for (const cn of names) {
  const clip = gltf.animations.find((a) => a.name === cn); if (!clip) { console.log(cn, 'introuvable'); continue; }
  mixer.stopAllAction(); const act = mixer.clipAction(clip).play();
  const N = 240, dt = clip.duration / N, S = [];
  for (let i = 0; i <= N; i++) { act.time = i * dt; mixer.update(0); scene.updateMatrixWorld(true); S.push({ hip: wp(hip), feet: feet.map((b) => wp(b)) }); }
  const drift = S[N].hip.clone().sub(S[0].hip); drift.y = 0;
  console.log(`${cn}: dérive horizontale de la hanche sur un cycle = ${drift.length().toFixed(3)} u (0 = in-place) ; oscillation verticale ${(Math.max(...S.map((s) => s.hip.y)) - Math.min(...S.map((s) => s.hip.y))).toFixed(2)} u`);
  // phases d'appui : pied bas ET qui recule dans le repère du corps
  const along = (p, h) => p.clone().sub(h).dot(fwd);
  const stance = feet.map((_, f) => {
    const ys = S.map((s) => s.feet[f].y), mn = Math.min(...ys), mx = Math.max(...ys), thr = mn + 0.3 * (mx - mn);
    const vel = S.map((s, i) => (i === 0 ? 0 : (along(s.feet[f], s.hip) - along(S[i - 1].feet[f], S[i - 1].hip)) / dt));
    const back = vel.filter((v) => v < 0).map(Math.abs).sort((a, b) => a - b); const medBack = back.length ? back[Math.floor(back.length / 2)] : 0;
    const flags = S.map((s, i) => s.feet[f].y < thr && vel[i] < -0.35 * medBack);
    return { flags, ratio: flags.filter(Boolean).length / flags.length };
  });
  console.log('  pieds :', feet.map((b, f) => `${b.name} appui ${(100 * stance[f].ratio).toFixed(0)} %`).join(' · '));
  // décalage de phase entre pieds (corrélation circulaire des hauteurs)
  const h = feet.map((_, f) => S.slice(0, N).map((s) => s.feet[f].y));
  const phase = (a, b) => { let best = 0, bv = -Infinity; const ma = a.reduce((x, y) => x + y, 0) / N, mb = b.reduce((x, y) => x + y, 0) / N; for (let k = 0; k < N; k++) { let c = 0; for (let i = 0; i < N; i++) c += (a[i] - ma) * (b[(i + k) % N] - mb); if (c > bv) { bv = c; best = k; } } return best / N; };
  const names2 = feet.map((b) => b.name.replace(/^b_/, '').replace(/0\d+$/, ''));
  console.log('  décalage de phase par rapport au pied 0 (' + names2[0] + ') :', names2.map((n, f) => `${n} ${phase(h[0], h[f]).toFixed(2)}`).join(' · '));
  const duty = stance.reduce((s, x) => s + x.ratio, 0) / stance.length;
  console.log(`  rapport cyclique moyen (part du cycle au sol) : ${(duty * 100).toFixed(0)} % → ${duty > 0.55 ? 'MARCHE (appuis longs)' : duty > 0.3 ? 'TROT / pas allongé' : 'COURSE / galop (appuis brefs, phase aérienne)'}`);
}
const bb = new THREE.Box3().setFromObject(scene);
console.log('\n=== 3. Échelle et axes ===');
console.log(`boîte du modèle (unités) : ${bb.min.toArray().map((v) => v.toFixed(1))} → ${bb.max.toArray().map((v) => v.toFixed(1))} ; axe avant détecté : (${fwd.x.toFixed(2)}, ${fwd.z.toFixed(2)}) ; haut = +Y`);
console.log(`longueur ${((bb.max.z - bb.min.z)).toFixed(0)} u, hauteur ${((bb.max.y - bb.min.y)).toFixed(0)} u`);
