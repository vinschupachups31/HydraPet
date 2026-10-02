/** Quatre scénarios de diagnostic des appuis avec la vraie chaîne locomotion → animation (utilisés par tools/slip-scenarios.mts et les tests). */
import * as THREE from 'three';
import { DEFAULT_ANIMATION } from '../../src/config/animation';
import { CLIP_DATA } from '../../src/config/foxClips';
import { FOX_STANDIN } from '../../src/config/pet';
import { DEFAULT_TURN } from '../../src/config/turning';
import { AnimationController } from '../../src/pet/animation';
import { contactPosition } from '../../src/pet/footIK';
import { OBSTACLES, WalkArea } from '../../src/pet/layout';
import { LocomotionController } from '../../src/pet/locomotor';
import { DEFAULT_BEHAVIOR as B } from '../../src/config/behavior';
import { loadFox } from './loadFox';

type Step = { goTo?: [number, number]; wait?: number };
export interface Traj { foot: number; contact: boolean; x: number; z: number; t: number; w: number; om: number; sp: number; ph: string; err: number; rel: boolean; y: number; stepping: boolean }
export interface Scenario { name: string; steps: Step[]; start: [number, number, number] }
export const SCENARIOS: Scenario[] = [
  { name: 'marche droite', start: [0, -0.8, 0], steps: [{ goTo: [0, 1.0] }, { wait: 0.3 }] },
  { name: 'freinage jusqu\'à l\'arrêt', start: [0, -0.8, 0], steps: [{ goTo: [0, 0.5] }, { wait: 2.5 }] },
  { name: 'virage à 90°', start: [-0.8, 0, Math.PI / 2], steps: [{ goTo: [0, 0] }, { goTo: [0, 0.9] }, { wait: 0.3 }] },
  { name: 'demi-tour', start: [0, -0.8, 0], steps: [{ goTo: [0, 0.6] }, { goTo: [0, -0.8] }, { wait: 0.3 }] },
];

const merge = (a: any, b: any) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) merge(a[k], b[k]); else a[k] = b[k]; } return a; };
export async function runScenario(sc: Scenario, ik: boolean, fps = 60, over: any = {}) {
  const { root, animations } = await loadFox();
  const group = new THREE.Group(); group.add(root); root.scale.setScalar(FOX_STANDIN.scale);
  const cfg = JSON.parse(JSON.stringify(DEFAULT_ANIMATION)); merge(cfg, over); cfg.ik.enabled = ik;
  const anim = new AnimationController(root, animations, FOX_STANDIN, cfg, CLIP_DATA);
  const area = new WalkArea(OBSTACLES);
  const nw = CLIP_DATA.Walk.nominalSpeed * FOX_STANDIN.scale, nr = CLIP_DATA.Run.nominalSpeed * FOX_STANDIN.scale;
  const loco = new LocomotionController({ ...DEFAULT_TURN, vWalk: nw, vRun: nr, arriveRadius: B.arrive.radius }, area, B.bodyRadius, B.stall, sc.start[0], sc.start[1], sc.start[2], B.arrive.hysteresis, 0.06);
  const contacts = FOX_STANDIN.footChains.map((c) => CLIP_DATA.Walk.feet.find((f) => f.bone === c.foot)!.contacts);
  const dt = 1 / fps, v = new THREE.Vector3(), traj: Traj[] = [];
  let t = 0;
  const tick = () => {
    loco.update(dt);
    group.position.set(loco.s.x, 0, loco.s.z); group.quaternion.set(0, loco.s.q.y, 0, loco.s.q.w); group.updateMatrixWorld(true);
    anim.update(dt, { realSpeed: loco.realSpeed, omega: loco.s.omega, pivoting: loco.s.pivoting }, { head: 0, spine: 0 });
    const d = anim.debug();
    anim.ik.feet.forEach((f, i) => { f.effector.getWorldPosition(v); const u = contactPosition(contacts[i], d.phase); traj.push({ foot: i, contact: u !== null && d.walkW > 0.5 && !anim.ik.feet[i].stepFrom, x: v.x, z: v.z, t, w: d.walkW, om: loco.s.omega, sp: loco.realSpeed, ph: loco.s.phase, err: d.feet[i].error, rel: d.feet[i].released, y: v.y, stepping: anim.ik.feet[i].stepFrom !== null }); });
    t += dt;
  };
  for (let i = 0; i < 40; i++) tick();
  const body: { x: number; z: number }[] = [];
  for (const st of sc.steps) {
    if (st.goTo) { loco.goTo(st.goTo[0], st.goTo[1]); for (let k = 0; k < 20 * fps && loco.isMoving; k++) { tick(); body.push({ x: loco.s.x, z: loco.s.z }); } }
    if (st.wait) for (let k = 0; k < st.wait * fps; k++) { tick(); body.push({ x: loco.s.x, z: loco.s.z }); }
  }
  // glissement : par appui continu (≥ 0,12 s), distance maximale parcourue par le pied depuis son premier contact
  const slips: number[] = []; const info: { slip: number; t: number; foot: number; om: number; sp: number; ph: string }[] = [];
  for (let f = 0; f < 4; f++) {
    const tr = traj.filter((p) => p.foot === f);
    let start = -1;
    for (let i = 0; i <= tr.length; i++) {
      const c = i < tr.length && tr[i].contact;
      if (c && start < 0) start = i;
      if (!c && start >= 0) {
        if (i - start >= 0.12 * fps) { const a = tr[start + Math.floor(0.12 * (i - start))]; let m = 0; for (let j = start; j < i; j++) m = Math.max(m, Math.hypot(tr[j].x - a.x, tr[j].z - a.z)); slips.push(m); info.push({ slip: m, t: tr[start].t, foot: f, om: tr[start].om, sp: tr[start].sp, ph: tr[start].ph }); }
        start = -1;
      }
    }
  }
  return { traj, slips, body, info };
}

