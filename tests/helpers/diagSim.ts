/** Banc de diagnostic hors ligne : vrai modèle, vraie chaîne locomotion → animation, mêmes scénarios que le diagnostic intégré. */
import * as THREE from 'three';
import { DEFAULT_ANIMATION } from '../../src/config/animation';
import { DEFAULT_BEHAVIOR as B } from '../../src/config/behavior';
import { CLIP_DATA } from '../../src/config/foxClips';
import { FOX_STANDIN } from '../../src/config/pet';
import { DEFAULT_TURN } from '../../src/config/turning';
import { ContactTracker, DEFAULT_SLIP, SlipConfig } from '../../src/pet/contactMetrics';
import { DIAG_SCENARIOS, DiagRunner } from '../../src/pet/diagnostic';
import { AnimationController } from '../../src/pet/animation';
import { OBSTACLES, WalkArea } from '../../src/pet/layout';
import { LocomotionController } from '../../src/pet/locomotor';
import { loadFox } from './loadFox';

const merge = (a: any, b: any) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) merge(a[k], b[k]); else a[k] = b[k]; } return a; };

export interface DiagFrame { t: number; reqSpeed: number; realSpeed: number; omega: number; w: number[]; rates: number[]; phases: string[]; feet: number[][]; measuring: boolean }

export async function runDiag(id: string, opts: { ik?: boolean; fps?: number; over?: any; slip?: Partial<SlipConfig>; frames?: boolean } = {}) {
  const fps = opts.fps ?? 60, dt = 1 / fps;
  const { root, animations } = await loadFox();
  const group = new THREE.Group(); group.add(root); root.scale.setScalar(FOX_STANDIN.scale);
  const cfg = JSON.parse(JSON.stringify(DEFAULT_ANIMATION)); merge(cfg, opts.over ?? {}); cfg.ik.enabled = opts.ik ?? true;
  const anim = new AnimationController(root, animations, FOX_STANDIN, cfg, CLIP_DATA);
  const area = new WalkArea(OBSTACLES);
  const nw = CLIP_DATA.Walk.nominalSpeed * FOX_STANDIN.scale, nr = CLIP_DATA.Run.nominalSpeed * FOX_STANDIN.scale;
  const loco = new LocomotionController({ ...DEFAULT_TURN, vWalk: nw, vRun: nr, arriveRadius: B.arrive.radius }, area, B.bodyRadius, B.stall, 0, 0.3, 0, B.arrive.hysteresis, 0.06);
  const runner = new DiagRunner({ goTo: (x, z, g) => loco.goTo(x, z, g), isMoving: () => loco.isMoving, face: (x, z) => loco.faceTowards(x, z), isFacing: () => loco.status === 'faced' });
  const tracker = new ContactTracker({ ...DEFAULT_SLIP, ...(opts.slip ?? {}) });
  const v = new THREE.Vector3(), frames: DiagFrame[] = [];
  runner.start(id);
  let t = 0;
  for (; t < 90 && runner.active; t += dt) {
    runner.update(dt);
    loco.update(dt);
    group.position.set(loco.s.x, 0, loco.s.z); group.quaternion.set(0, loco.s.q.y, 0, loco.s.q.w); group.updateMatrixWorld(true);
    anim.update(dt, { realSpeed: loco.realSpeed, omega: loco.s.omega, pivoting: loco.s.pivoting }, { head: 0, spine: 0 });
    const d = anim.debug();
    const feet = anim.ik.feet.map((f, i) => { f.effector.getWorldPosition(v); return { x: v.x, y: v.y, z: v.z, phase: anim.contactPhase(i) }; });
    if (runner.measuring) tracker.push({ t, x: loco.s.x, z: loco.s.z, heading: loco.s.heading, speed: loco.realSpeedRaw, omega: loco.s.omega }, feet);
    if (opts.frames) frames.push({ t, reqSpeed: loco.requestedSpeed, realSpeed: loco.realSpeed, omega: loco.s.omega, w: [d.idleW, d.walkW, d.runW], rates: [d.walkRate, d.runRate], phases: feet.map((f) => f.phase), feet: feet.map((f) => [f.x, f.y, f.z]), measuring: runner.measuring });
  }
  tracker.finish(t);
  const runs = tracker.runs;
  return { runs, tracker, report: tracker.report(), frames, scenario: DIAG_SCENARIOS.find((s) => s.id === id)!, anim, loco };
}
export { DIAG_SCENARIOS };
