/* Extrait d'un GLB animé : vitesse nominale (sans glissement) et phases d'appui de chaque patte, par clip.
   Écrit un module TypeScript de métadonnées.
   Usage : node tools/extract-contacts.mjs assets/models/fox.glb src/config/foxClips.ts Walk Run */
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const [file, out, ...clipNames] = process.argv.slice(2);
const feetArg = (process.argv.find((a) => a.startsWith('--feet=')) || '').split('=')[1];
const io = new NodeIO();
const doc = await io.read(file);
doc.getRoot().listMaterials().forEach((m) => m.setBaseColorTexture(null));
doc.getRoot().listTextures().forEach((t) => t.dispose());
const bin = await io.writeBinary(doc);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '', res, rej));
const scene = gltf.scene; scene.updateMatrixWorld(true);
const bones = []; scene.traverse((o) => { if (o.isBone) bones.push(o); });
const hip = bones.find((b) => /hip|pelvis/i.test(b.name)), head = bones.find((b) => /head/i.test(b.name));
const feet = (feetArg ? feetArg.split(',').map((n) => bones.find((b) => b.name === n)) : bones.filter((b) => /(hand|foot02)/i.test(b.name))).filter(Boolean);
const wp = (b) => b.getWorldPosition(new THREE.Vector3());
const fwd = wp(head).sub(wp(hip)); fwd.y = 0; fwd.normalize();
const mixer = new THREE.AnimationMixer(scene);
const N = 360;
const result = [];
for (const cn of clipNames) {
  const clip = gltf.animations.find((a) => a.name === cn); if (!clip) throw new Error('clip introuvable : ' + cn);
  mixer.stopAllAction(); const act = mixer.clipAction(clip).play();
  const dt = clip.duration / N, S = [];
  for (let i = 0; i < N; i++) { act.time = i * dt; mixer.update(0); scene.updateMatrixWorld(true); S.push({ hip: wp(hip), feet: feet.map((b) => wp(b)) }); }
  const al = (s, f) => s.feet[f].clone().sub(s.hip).dot(fwd);
  const per = feet.map((b, f) => {
    const ys = S.map((s) => s.feet[f].y), mn = Math.min(...ys), mx = Math.max(...ys), thr = mn + 0.3 * (mx - mn);
    const vel = S.map((s, i) => (al(s, f) - al(S[(i - 1 + N) % N], f)) / dt); // circulaire
    const back = vel.filter((v) => v < 0).map(Math.abs).sort((a, c) => a - c), med = back.length ? back[Math.floor(back.length / 2)] : 0;
    let flags = S.map((s, i) => s.feet[f].y < thr && vel[i] < -0.35 * med);
    // comble les petits trous (≤ 3 %) puis supprime les appuis trop brefs (< 8 %)
    const gap = Math.round(0.03 * N), minLen = Math.round(0.08 * N);
    const fill = [...flags];
    for (let i = 0; i < N; i++) if (!flags[i]) { let l = 0; while (!flags[(i + l) % N] && l <= gap) l++; let k = 0; while (!flags[(i - k + N) % N] && k <= gap) k++; if (l <= gap && k <= gap && flags.some(Boolean)) fill[i] = true; }
    flags = fill;
    const start = flags.findIndex((v, i) => v && !flags[(i - 1 + N) % N]);
    const intervals = [];
    if (start >= 0) { let i = start, count = 0; while (count < N) { if (flags[i % N]) { let j = 0; while (flags[(i + j) % N] && count + j < N) j++; if (j >= minLen) intervals.push([+((i % N) / N).toFixed(3), +(((i + j) % N) / N).toFixed(3)]); i += j; count += j; } else { i++; count++; } } }
    // vitesse de recul moyenne pendant l'appui (repère du corps) = vitesse « sans glissement »
    const sel = vel.filter((_, i) => flags[i]).map((v) => -v);
    const mean = sel.length ? sel.reduce((a, c) => a + c, 0) / sel.length : 0;
    return { bone: b.name, contacts: intervals, meanBackSpeed: mean, ratio: flags.filter(Boolean).length / N };
  });
  const speeds = per.map((p) => p.meanBackSpeed).filter((v) => v > 0);
  const nominal = speeds.reduce((a, c) => a + c, 0) / speeds.length;
  result.push({ name: cn, duration: +clip.duration.toFixed(3), nominalSpeed: +nominal.toFixed(1), feet: per.map(({ bone, contacts }) => ({ bone, contacts })), debug: per.map((p) => `${p.bone}: ${(100 * p.ratio).toFixed(0)} % au sol, recul moyen ${p.meanBackSpeed.toFixed(0)} u/s, appuis ${JSON.stringify(p.contacts)}`) });
}
result.forEach((r) => { console.log(`${r.name}: durée ${r.duration} s, vitesse nominale ${r.nominalSpeed} u/s`); r.debug.forEach((d) => console.log('   ' + d)); });
const ts = `/* Généré par tools/extract-contacts.mjs depuis ${file.split('/').pop()} : ne pas modifier à la main.
   Vitesse nominale = vitesse de recul moyenne des pieds en appui, en unités du modèle par seconde, à lecture normale.
   Appuis = intervalles de phase normalisée [0, 1[ pendant lesquels chaque pied est posé et recule (un intervalle peut chevaucher 1 → 0). */
export interface FootContacts { bone: string; contacts: [number, number][] }
export interface ClipLocomotionData { name: string; duration: number; nominalSpeed: number; feet: FootContacts[] }

export const CLIP_DATA: Record<string, ClipLocomotionData> = ${JSON.stringify(Object.fromEntries(result.map((r) => [r.name, { name: r.name, duration: r.duration, nominalSpeed: r.nominalSpeed, feet: r.feet }])), null, 2)};
`;
fs.writeFileSync(out, ts);
console.log('écrit', out);
