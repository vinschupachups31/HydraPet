// @ts-nocheck
/* Ajuste une pose pour que les dessous de patte désignés touchent le sol (après correction du bassin), avec un faible rappel vers la pose de départ.
   Usage : node --import tsx tools/cat/fit-pose.mts <pose> '<json {free:[[clé,axe,min,max],...], feet:{avD:0.004,...}, reg:0.02, sym:[[a,b],...]}>' */
import * as THREE from 'three';
import { makeRigSim } from '../../tests/helpers/rigSim';
import { POSES } from '../../src/config/postures';
const [name, specJson] = process.argv.slice(2); const spec = JSON.parse(specJson);
const s = await makeRigSim(3); const v = new THREE.Vector3();
const pose = JSON.parse(JSON.stringify(POSES[name])); const FEET = { avD: 0, avG: 1, arG: 2, arD: 3 };
for (const [k] of spec.free) pose.r[k] ??= [0, 0, 0];
const base = spec.free.map(([k, i]) => pose.r[k][i]);
const sym = Object.fromEntries((spec.sym ?? []).flatMap(([a, b]) => [[a, b], [b, a]]));
const set = (k, i, val) => { pose.r[k][i] = val; if (sym[k]) { pose.r[sym[k]] ??= [0, 0, 0]; pose.r[sym[k]][i] = val; } };
const eval_ = () => {
  s.anim.mixer.setTime(0); s.anim.mixer.update(0); s.root.updateMatrixWorld(true);
  s.anim.rig.apply(pose, 1); s.root.updateMatrixWorld(true); s.anim.rig.groundSolve(1); s.root.updateMatrixWorld(true);
  let c = 0; const ys = s.anim.ik.feet.map((f) => { s.anim.ik.contactPoint(f, v); return v.y; });
  for (const [n, target] of Object.entries(spec.feet)) { c += ((ys[FEET[n]] - target) * 100) ** 2; }
  let reg = 0; spec.free.forEach(([k, i], j) => { reg += ((pose.r[k][i] - base[j]) / 40) ** 2; });
  return { cost: c + (spec.reg ?? 0.02) * reg * 100, ys };
};
let best = eval_().cost, step = 12;
for (let it = 0; it < 400 && step > 0.25; it++) {
  let imp = false;
  for (const [k, i, lo, hi] of spec.free) for (const sg of [1, -1]) { const old = pose.r[k][i]; set(k, i, Math.max(lo, Math.min(hi, old + sg * step))); const c = eval_().cost; if (c < best - 1e-7) { best = c; imp = true; } else set(k, i, old); }
  if (!imp) step *= 0.6;
}
const r = eval_();
console.log('semelles (cm) avD/avG/arG/arD :', r.ys.map((y) => (y * 100).toFixed(1)).join(' / '), '| bassin abaissé de', (-s.anim.rig.groundShift * 100).toFixed(1), 'cm');
console.log(JSON.stringify(Object.fromEntries(spec.free.map(([k]) => [k, pose.r[k].map((x) => +x.toFixed(1))]))));
