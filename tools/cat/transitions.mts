// @ts-nocheck
/* Hauteur des quatre dessous de patte (cm) pendant chaque transition de posture : pic de flottement / pénétration et durée au-dessus de 1 cm.
   Usage : node --import tsx tools/cat/transitions.mts */
import * as THREE from 'three';
import { makeRigSim } from '../../tests/helpers/rigSim';
const names = ['avD', 'avG', 'arG', 'arD'], v = new THREE.Vector3();
async function seq(label, start, until) {
  const s = await makeRigSim(3);
  start(s); const rows = []; const dt = 1 / 60; let t = 0;
  while (t < 40) { s.step(dt); t += dt; const ys = s.anim.ik.feet.map((f) => { s.anim.ik.contactPoint(f, v); return v.y; }); rows.push({ t, ys, low: s.anim.rig.lowestY(), st: s.posture.state }); if (until(s, t)) break; }
  const out = names.map((n, i) => { const a = rows.map((r) => r.ys[i]); return `${n} ${(Math.min(...a) * 100).toFixed(1)}..${(Math.max(...a) * 100).toFixed(1)}`; });
  const states = [...new Set(rows.map((r) => r.st))].join('>');
  const last = rows[rows.length - 1].ys.map((y) => (y * 100).toFixed(1)).join(' / ');
  console.log(label.padEnd(18), 'final avD/avG/arG/arD', last.padEnd(22), '|', `${rows.length / 60 | 0}s`, out.join(' | '), '| plus bas du corps', (Math.min(...rows.map((r) => r.low)) * 100).toFixed(1), '|', states);
}
const to = (g) => (s) => s.posture.request(g), done = (g) => (s, t) => t > 1 && s.posture.posture === g && !s.posture.busy;
await seq('debout→assis', to('sit'), done('sit'));
await seq('debout→couché', to('lie'), done('lie'));
await seq('debout→sommeil', to('sleep'), done('sleep'));
await seq('étirement', (s) => s.posture.stretch(), (s, t) => t > 1 && s.posture.lastDone?.name === 'Stretching' && !s.posture.busy);
await seq('toilette', (s) => { s.posture.request('sit'); }, (s) => false && s);
