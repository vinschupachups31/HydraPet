/* Audit des transitions de posture : sauts entre images, glissement des pieds posés, dérive après plusieurs cycles.
   Usage : node --import tsx tools/audit-transitions.mts */
import * as THREE from 'three';
import { makeRigSim } from '../tests/helpers/rigSim';

const s = await makeRigSim(4);
const P = s.posture, dt = 1 / 60;
const pts: THREE.Vector3[] = [];
let prevPts: THREE.Vector3[] | null = null;
const seqStats: Record<string, { jump: number; slide: number; hipJump: number; maxLowest: number; minLowest: number }> = {};
const feetKeys = ['handL', 'handR', 'footL2', 'footR2'] as const;
const minY: Record<string, number> = {}; const runStart: Record<string, THREE.Vector3 | null> = {};

function frame() {
  s.rig.hullWorld(pts);
  const name = P.seq ? P.seq.def.name + `(${P.seq.def.from}→${P.seq.def.to})` : null;
  if (name) {
    const st = seqStats[name] ??= { jump: 0, slide: 0, hipJump: 0, maxLowest: -Infinity, minLowest: Infinity };
    if (prevPts) for (let i = 0; i < pts.length; i++) st.jump = Math.max(st.jump, pts[i].distanceTo(prevPts[i]) / dt);
    const lo = s.lowest(); st.maxLowest = Math.max(st.maxLowest, lo); st.minLowest = Math.min(st.minLowest, lo);
    for (const k of feetKeys) {
      const p = s.pos(k); minY[k] = Math.min(minY[k] ?? Infinity, p.y);
      const grounded = p.y < minY[k] + 0.006;
      if (grounded) { runStart[k] ??= p.clone(); st.slide = Math.max(st.slide, Math.hypot(p.x - runStart[k]!.x, p.z - runStart[k]!.z)); } else runStart[k] = null;
    }
  } else for (const k of feetKeys) runStart[k] = null;
  prevPts = name ? pts.map((p) => p.clone()) : null; // seules les images consécutives d'une même séquence se comparent
}
const go = (goal: 'stand' | 'sit' | 'lie' | 'sleep') => { P.request(goal); s.run(dt, 30, () => P.posture === goal && !P.busy, frame); };
for (let i = 0; i < 90; i++) s.step(dt);
const snap = () => Object.fromEntries(s.rig.keys.map((k) => [k, s.pos(k).toArray()]));
let first: Record<string, number[]> | null = null, worstDrift = 0;
for (let cycle = 0; cycle < 6; cycle++) {
  go('sleep'); for (let i = 0; i < 120; i++) { s.step(dt); frame(); }
  go('stand');
  P.stretch(); s.run(dt, 10, () => P.lastDone?.name === 'Stretching' && !P.busy, frame);
  P.request('sit'); go('sit'); P.groom(); s.run(dt, 40, () => P.lastDone?.name === 'Grooming' && !P.busy, frame); go('stand');
  for (let i = 0; i < 90; i++) s.step(dt);
  const cur = snap();
  if (!first) first = cur; else for (const k of ['hip', 'handL', 'handR', 'footL2', 'footR2', 'tail1']) worstDrift = Math.max(worstDrift, Math.hypot(cur[k][0] - first[k][0], cur[k][1] - first[k][1], cur[k][2] - first[k][2]));
}
console.log('séquence'.padEnd(30), 'vitesse max d\'un point (m/s)', ' glissement pied posé (cm)', ' sol (cm)');
for (const [n, v] of Object.entries(seqStats)) console.log(n.padEnd(30), v.jump.toFixed(2).padStart(12), String((v.slide * 100).toFixed(1)).padStart(26), `  ${(v.minLowest * 100).toFixed(1)}…${(v.maxLowest * 100).toFixed(1)}`);
console.log(`\nDérive après 6 cycles sommeil/étirement/toilette : ${(worstDrift * 100).toFixed(2)} cm (pose debout finale vs cycle 1) · parent ${s.group.position.length().toFixed(3)} m`);
