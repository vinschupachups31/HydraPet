/* Enveloppes conservatrices par pose (sommets extrêmes du maillage dans le repère de l'animal, mètres) : servent à vérifier,
   AVANT de choisir une destination, que le compagnon entier (tête, queue, pattes) reste dans le cadre dans la pose attendue.
   Usage : node --import tsx tools/extract-envelopes.mts > src/config/foxEnvelopes.ts */
import * as THREE from 'three';
import { makeRigSim } from '../tests/helpers/rigSim';

const dirs: number[][] = [];
for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) if (a || b || c) dirs.push([a, b, c]);
const out: Record<string, number[][]> = {};
const acc: Record<string, THREE.Vector3[]> = {};
const add = (k: string, pts: THREE.Vector3[]) => { (acc[k] ??= []).push(...pts.map((p) => p.clone())); };

const s = await makeRigSim(3);
const pts: THREE.Vector3[] = [];
// debout : Survey (regard qui balaie) à plusieurs instants, avec tête tournée à ±50° pour couvrir le regard
for (let t = 0; t < 3.4; t += 0.2) { s.anim.mixer.setTime(t); s.anim.update(0.0001, { realSpeed: 0, omega: 0, pivoting: false }, { head: 0, spine: 0, pitch: 0 }); add('stand', s.rig.hullWorld(pts)); }
for (const yaw of [-0.9, 0.9]) { s.anim.update(0.0001, { realSpeed: 0, omega: 0, pivoting: false }, { head: yaw, spine: yaw * 0.4, pitch: 0 }); add('stand', s.rig.hullWorld(pts)); }
// marche : cycle complet (la queue et la tête oscillent)
const w = { realSpeed: 0.56, omega: 0, pivoting: false };
for (let i = 0; i < 120; i++) { s.anim.update(1 / 60, w, { head: 0, spine: 0, pitch: 0 }); if (i > 40) add('walk', s.rig.hullWorld(pts)); }
const hold = (goal: 'sit' | 'lie' | 'sleep' | 'stand', key: string, collect = true) => { s.posture.request(goal); s.run(1 / 60, 30, () => s.posture.posture === goal && !s.posture.busy, () => { if (collect && s.posture.weight > 0.5) add(key, s.rig.hullWorld(pts)); }); };
for (let i = 0; i < 240; i++) { s.posture.update(1 / 60); }
hold('sit', 'sit');
s.posture.groom(); s.run(1 / 60, 40, () => s.posture.lastDone?.name === 'Grooming' && !s.posture.busy, () => add('groom', s.rig.hullWorld(pts)));
hold('lie', 'lie', true); hold('sleep', 'sleep', true);
hold('stand', 'x', false);
s.posture.stretch(); s.run(1 / 60, 10, () => s.posture.lastDone?.name === 'Stretching' && !s.posture.busy, () => add('stretch', s.rig.hullWorld(pts)));
for (const [k, all] of Object.entries(acc)) {
  const keep = new Map<string, THREE.Vector3>();
  for (const d of dirs) { let b = all[0], bv = -Infinity; for (const p of all) { const v = p.x * d[0] + p.y * d[1] + p.z * d[2]; if (v > bv) { bv = v; b = p; } } keep.set(`${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)}`, b); }
  out[k] = [...keep.values()].map((p) => [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)]);
}
console.log(`/** Généré par tools/extract-envelopes.mts : enveloppes conservatrices par pose (m ; x gauche, y haut, z avant ; origine au sol sous le bassin). */\nexport const FOX_ENVELOPES: Record<string, number[][]> = ${JSON.stringify(out)};`);
