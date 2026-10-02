/* Analyse un GLB animé : clips, os, triangles, et vitesse de déplacement « sans glissement » de chaque clip.
   Usage : node tools/analyze-clips.mjs assets/models/fox.glb [--feet=os1,os2,...] [--head=os] [--json]
   Principe : pendant l'appui d'une patte au sol, sa vitesse (repère du corps) est l'opposé de la vitesse
   d'avance du corps. Faire avancer l'animal à cette vitesse × le time-scale du clip évite le patinage. */
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NodeIO } from '@gltf-transform/core';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
if (!file) { console.error('usage: node tools/analyze-clips.mjs <fichier.glb> [--feet=a,b,c,d] [--head=os]'); process.exit(1); }

// 1) retire les textures (GLTFLoader n'a pas besoin d'image pour l'analyse, et Node n'a pas de décodeur d'image)
const io = new NodeIO();
const doc = await io.read(file);
const stats = { triangles: 0, textures: doc.getRoot().listTextures().map((t) => `${t.getMimeType()} ${t.getSize()?.join('x')}`), materials: doc.getRoot().listMaterials().length };
doc.getRoot().listMeshes().forEach((m) => m.listPrimitives().forEach((p) => { const i = p.getIndices(); stats.triangles += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }));
doc.getRoot().listMaterials().forEach((m) => m.setBaseColorTexture(null).setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null));
doc.getRoot().listTextures().forEach((t) => t.dispose());
const bin = await io.writeBinary(doc);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '', res, rej));

const scene = gltf.scene;
scene.updateMatrixWorld(true);
const bones = [];
scene.traverse((o) => { if (o.isBone) bones.push(o); });
const byName = (n) => bones.find((b) => b.name === n);
const guess = (re) => bones.filter((b) => re.test(b.name) && !bones.some((c) => c.parent === b && re.test(c.name)));
const feet = (opt('feet') ? opt('feet').split(',').map(byName) : guess(/foot|paw|hand|toe/i)).filter(Boolean);
const head = opt('head') ? byName(opt('head')) : bones.find((b) => /head/i.test(b.name));
const hip = bones.find((b) => /hip|pelvis/i.test(b.name)) || bones[0];
if (feet.length < 2 || !head) { console.error('Os de pattes/tête introuvables. Bones :', bones.map((b) => b.name).join(', ')); process.exit(2); }

const wp = (b) => b.getWorldPosition(new THREE.Vector3());
// axe d'avance = du bassin vers la tête, projeté au sol
scene.updateMatrixWorld(true);
const fwd = wp(head).sub(wp(hip)); fwd.y = 0; fwd.normalize();
const rootBox = new THREE.Box3().setFromObject(scene);

const mixer = new THREE.AnimationMixer(scene);
const out = { file, triangles: stats.triangles, joints: bones.length, textures: stats.textures, forward: fwd.toArray().map((v) => +v.toFixed(3)), bbox: { min: rootBox.min.toArray().map((v) => +v.toFixed(1)), max: rootBox.max.toArray().map((v) => +v.toFixed(1)) }, feet: feet.map((b) => b.name), clips: {} };
for (const clip of gltf.animations) {
  mixer.stopAllAction();
  const action = mixer.clipAction(clip).play();
  const N = 400, dt = clip.duration / N;
  const samples = [];
  for (let i = 0; i <= N; i++) {
    action.time = i * dt; mixer.update(0); scene.updateMatrixWorld(true);
    samples.push(feet.map((b) => { const p = wp(b); return { along: p.dot(fwd), y: p.y }; }));
  }
  const ys = samples.flat().map((s) => s.y), ymin = Math.min(...ys), ymax = Math.max(...ys);
  // l'appui = patte proche de son point le plus bas ; on teste plusieurs seuils pour vérifier la stabilité
  const measure = (frac) => {
    const thr = ymin + frac * (ymax - ymin), v = []; let stance = 0, total = 0;
    for (let i = 1; i <= N; i++) feet.forEach((_, f) => {
      total++;
      if (samples[i][f].y < thr && samples[i - 1][f].y < thr) { stance++; v.push(-(samples[i][f].along - samples[i - 1][f].along) / dt); }
    });
    v.sort((a, b) => a - b);
    const q = (x) => (v.length ? v[Math.min(v.length - 1, Math.floor(v.length * x))] : 0);
    return { med: q(0.5), p25: q(0.25), p75: q(0.75), stance: stance / total, n: v.length };
  };
  // profil de vitesse selon la phase : vitesse d'avance du corps qui garde les pattes en appui plantées
  const BINS = 48, prof = new Array(BINS).fill(0), cnt = new Array(BINS).fill(0);
  const thr8 = ymin + 0.1 * (ymax - ymin);
  for (let i = 1; i <= N; i++) {
    const bin = Math.min(BINS - 1, Math.floor(((i - 0.5) / N) * BINS));
    feet.forEach((_, f) => {
      if (samples[i][f].y < thr8 && samples[i - 1][f].y < thr8) { prof[bin] += -(samples[i][f].along - samples[i - 1][f].along) / dt; cnt[bin]++; }
    });
  }
  const filled = prof.map((v, k) => (cnt[k] ? v / cnt[k] : null));
  // comble les phases sans appui par interpolation circulaire, puis lisse
  const known = filled.map((v, k) => (v === null ? -1 : k)).filter((k) => k >= 0);
  const phaseSpeed = filled.map((v, k) => {
    if (v !== null) return v;
    let lo = known.filter((q) => q < k).pop(); if (lo === undefined) lo = known[known.length - 1];
    let hi = known.find((q) => q > k); if (hi === undefined) hi = known[0];
    const dl = (k - lo + BINS) % BINS, dh = (hi - k + BINS) % BINS, w = dl / (dl + dh || 1);
    return filled[lo] * (1 - w) + filled[hi] * w;
  });
  const smooth = phaseSpeed.map((_, k) => { let a = 0; for (let d = -2; d <= 2; d++) a += phaseSpeed[(k + d + BINS) % BINS]; return a / 5; });
  const meanPS = smooth.reduce((a, b) => a + b, 0) / BINS;
  const sdPS = Math.sqrt(smooth.reduce((a, b) => a + (b - meanPS) ** 2, 0) / BINS);
  const ms = [0.04, 0.08, 0.12, 0.2].map(measure);
  const main = ms[1];
  out.clips[clip.name] = {
    duration: +clip.duration.toFixed(3), tracks: clip.tracks.length,
    stanceRatio: +main.stance.toFixed(2),
    groundSpeedUnitsPerSec: +main.med.toFixed(2),
    iqr: +(main.p75 - main.p25).toFixed(2),
    medianByThreshold: ms.map((m) => +m.med.toFixed(1)),
    footTravelPerCycle: +(Math.abs(main.med) * clip.duration).toFixed(2),
    phaseSpeed: smooth.map((v) => +(v / (meanPS || 1)).toFixed(3)), // multiplicateur autour de 1, 48 phases
    meanPhaseSpeed: +meanPS.toFixed(2),
    phaseVariation: +(sdPS / (Math.abs(meanPS) || 1)).toFixed(2),
  };
}
if (args.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`${file}\n  triangles: ${out.triangles} · os: ${out.joints} · textures: ${out.textures.join(', ') || 'aucune'} · avant: ${out.forward.join(',')}`);
  console.log(`  pattes analysées: ${out.feet.join(', ')}\n`);
  console.log('  clip       durée   appui   vitesse au sol   IQR     médianes selon seuil d\'appui (4/8/12/20 %)');
  for (const [n, c] of Object.entries(out.clips)) console.log(`  ${n.padEnd(9)} vitesse moyenne selon phase ${c.meanPhaseSpeed} u/s, variation ${(c.phaseVariation * 100).toFixed(0)} %\n  ${' '.repeat(9)} ${String(c.duration).padEnd(7)} ${String(c.stanceRatio).padEnd(7)} ${String(c.groundSpeedUnitsPerSec).padEnd(16)} ${String(c.iqr).padEnd(7)} ${c.medianByThreshold.join(' / ')}`);
}
